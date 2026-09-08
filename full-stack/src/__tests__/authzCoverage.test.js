import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MATRIX, EXEMPT } from '@/lib/permissionsMatrix';

const ACTIONS_DIR = 'src/server/actions';
const API_DIR = 'src/app/api';

// ── 掃描核心。正式檢查與負向 fixture 走「完全同一組 helper」──
// 這點很重要：v1 的寫法讓 fixture 用另一條 regex 驗證，結果測試綠但沒驗到正式邏輯。

/**
 * 遞迴列出 action 檔（相對於 ACTIONS_DIR 的路徑，例如 "tasks.js" 或 "admin/hidden.js"）。
 * 必須遞迴——否則子目錄裡的 action（如 `admin/hidden.js`）對 inventory 完全隱形，
 * 造成兩側掃描深度不對稱（route 那側 listRouteFiles 本來就是遞迴的）。
 * 排除 `__tests__`：那裡面的 export 是測試輔助，不是 action。
 */
function listActionFiles(dir = ACTIONS_DIR, out = [], base = dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      listActionFiles(join(dir, e.name), out, base);
    } else if (/\.(js|jsx|mjs|ts|tsx)$/.test(e.name)) {
      out.push(join(dir, e.name).replace(/\\/g, '/').slice(base.length + 1));
    }
  }
  return out;
}

function listRouteFiles(dir = API_DIR, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listRouteFiles(p, out);
    else if (e.name === 'route.js') out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

/**
 * server action 的 export。三種合法寫法都要抓，否則 inventory 可被繞過：
 *   export async function NAME(...)
 *   export const NAME = async (...) => ...
 *   async function NAME(){}; export { NAME }
 */
function listActionExports(src) {
  const decls  = [...src.matchAll(/^export\s+async\s+function\s+(\w+)/gm)].map(m => m[1]);
  const consts = [...src.matchAll(/^export\s+const\s+(\w+)\s*=/gm)].map(m => m[1]);
  const named  = [...src.matchAll(/^export\s*\{([^}]*)\}/gm)]
    .flatMap(m => m[1].split(',')
      .map(x => x.split(/\s+as\s+/).pop().trim())
      .filter(Boolean));
  return [...new Set([...decls, ...consts, ...named])];
}

/** route 形式：export const GET = ... 或 export async function GET(...) */
function listRouteExports(src) {
  const named = [...src.matchAll(/^export\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/gm)].map(m => m[1]);
  const fns = [...src.matchAll(/^export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/gm)].map(m => m[1]);
  return [...new Set([...named, ...fns])];
}

/**
 * 取出 function body 的**第一個 statement**，回傳 `{ text, source }`。
 * `source` 標記這個 statement 是從哪種形狀擷取出來的（'fn' = function 宣告、
 * 'arrow' = const-arrow）——`actionIsWrapped` 要靠這個標記分開判定，
 * 否則「裸呼叫 withCap（沒 return/await，結果被丟棄）」會被 function 宣告那條
 * 誤判成「有包」，實際上後面的程式碼完全無授權執行。
 * 這也是護欄的關鍵：只看第一個 statement，`if (false) { return withCap(...) }`
 * 這種死分支就不會被誤判成「有包」。
 */
function firstStatementOf(src, name) {
  const decl = new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'm');
  const m = decl.exec(src);
  if (m) {
    const body = src.slice(m.index + m[0].length);
    // 第一個 statement = 到第一個分號或第一個 { 為止（去掉註解與空白）
    const cleaned = body.replace(/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*\s*/, '');
    const end = cleaned.search(/[;{]/);
    const text = end < 0 ? cleaned.trim() : cleaned.slice(0, end + 1).trim();
    return { text, source: 'fn' };
  }
  const arrow = constArrowBodyOf(src, name);
  return arrow ? { text: arrow, source: 'arrow' } : null;
}

/**
 * `export const NAME = async (...) => withCap(...)` 或
 * `export const NAME = async (...) => { return withCap(...); }` 形式的第一個 statement。
 * 沒有這個 fallback，inventory 說支援 const-arrow 形式，但驗證只認 `export async function`，
 * 正確包了 withCap 的 const-arrow action 會被誤判成沒包，錯誤訊息還會誘導人去加 EXEMPT 開後門。
 */
function constArrowBodyOf(src, name) {
  const m = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(?[^)]*\\)?\\s*=>\\s*\\{?\\s*(?:return\\s+)?([^\\n]*)`, 'm').exec(src);
  return m ? m[1].trim() : null;
}

/**
 * 取出 route handler 的包裝來源。接受兩種形狀：
 *   (a) export const GET = withRouteCap('cap', ...)             ← 絕大多數 route
 *   (b) export async function GET(...) { ...; return h(...); }
 *       const h = withRouteCap('cap', ...)                       ← 需在授權前先做別的判斷時
 *
 * (b) 存在的理由：`/api/debug` 要在正式環境一律回 404（不洩漏該端點存在），
 * 那個判斷不是 session 授權，必須跑在 withRouteCap 之前。若把 withRouteCap 放最外層，
 * 正式環境未登入會回 401 而不是 404，等於承認這條路徑存在。
 * 兩種形狀都仍保證「業務邏輯只在 withRouteCap 的 callback 裡執行」。
 */
function routeAssignmentOf(src, method) {
  const direct = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*([^\\n]*)`, 'm').exec(src);
  if (direct) return direct[1].trim();

  // (b)：找出 handler 委派給哪個識別字，再回去看那個識別字的定義
  const fn = new RegExp(`export\\s+async\\s+function\\s+${method}\\b[\\s\\S]*?\\n\\}`, 'm').exec(src);
  if (!fn) return null;
  const delegate = /return\s+(\w+)\s*\(/.exec(fn[0]);
  if (!delegate) return null;
  // 委派前不得出現 db. 或 await——否則業務邏輯已經在授權檢查前跑掉了，
  // 委派目標即使有包 withRouteCap 也救不回來。
  const before = fn[0].slice(0, delegate.index);
  if (/\bdb\.|\bawait\b/.test(before)) return null;
  const def = new RegExp(`const\\s+${delegate[1]}\\s*=\\s*([^\\n]*)`, 'm').exec(src);
  return def ? def[1].trim() : null;
}

/**
 * 正式判定：這支 action 的第一個 statement 是不是對應的 withCap。
 * 依 `firstStatementOf` 回傳的 `source` 分開判定——這條分岔是 fix round 2 的重點：
 *   - function 宣告（source === 'fn'）：**必須把 withCap 的結果 return 或 await 出去**。
 *     裸呼叫 `withCap('write', async () => {})`（沒有 return/await）不算，因為呼叫端
 *     不會等那個 Promise，後面的程式碼會在授權檢查完成前就先執行——是貨真價實的繞過，
 *     不是可接受的誤判。
 *   - const-arrow（source === 'arrow'）：箭頭函式的 body 本身就是回傳值，
 *     `withCap(...)` 或 `return withCap(...)`（block 形式）都算。
 * 不要為了讓某支通過而再放寬——放寬到能通過死分支或裸呼叫，自我驗證那幾條就會紅。
 */
function actionIsWrapped(src, name, cap) {
  const first = firstStatementOf(src, name);
  if (!first) return false;
  const c = `\\s*['"]${cap}['"]`;
  if (first.source === 'fn') {
    return new RegExp(`^return\\s+withCap\\(${c}`).test(first.text)
        || new RegExp(`^const\\s+\\w+\\s*=\\s*await\\s+withCap\\(${c}`).test(first.text);
  }
  return new RegExp(`^withCap\\(${c}`).test(first.text)
      || new RegExp(`^return\\s+withCap\\(${c}`).test(first.text);
}

/** 正式判定：這支 route handler 是不是 `withRouteCap('<cap>'` 的產物 */
function routeIsWrapped(src, method, cap) {
  const assign = routeAssignmentOf(src, method);
  if (!assign) return false;
  return new RegExp(`^withRouteCap\\(\\s*['"]${cap}['"]`).test(assign);
}

/**
 * 這支檔案有沒有頂層 `export default`。抽成共用函式而不是各處各寫一條 regex——
 * 上一輪的自我驗證測試把同一條 regex 寫死在測試裡驗自己，是恆真句，
 * 正式那條的 regex 被改壞也測不出來。正式檢查與自我驗證都必須呼叫這支。
 */
function hasDefaultExport(src) {
  return /^export\s+default\b/m.test(src);
}

/**
 * 檔案開頭是否有頂層 `'use server'` 指令（掃前 20 行，容納版權/授權註解區塊
 * 之後才出現的指令）。Next.js 判定 Server Action 看的是這個指令，跟目錄位置無關——
 * 把它放在 `ACTIONS_DIR` 之外，護欄的清點與 withCap 檢查會完全看不到它。
 */
function hasUseServerDirective(src) {
  return /^\s*(['"])use server\1\s*;?\s*$/m.test(src.split('\n').slice(0, 20).join('\n'));
}

/** 遞迴列出 src/ 下所有 js/jsx/mjs/ts/tsx 檔案（絕對排除 node_modules） */
function listAllSrcFiles(dir = 'src', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      listAllSrcFiles(p, out);
    } else if (/\.(js|jsx|mjs|ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('授權覆蓋率護欄', () => {
  it('每一支 server action export 都必須在 matrix 中被分類', () => {
    const unclassified = [];
    for (const file of listActionFiles()) {
      const key = `${ACTIONS_DIR}/${file}`;
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      for (const name of listActionExports(src)) {
        if (EXEMPT.includes(`${key}#${name}`)) continue;
        if (!MATRIX[key]?.[name]) unclassified.push(`${key}#${name}`);
      }
    }
    expect(unclassified, '這些 export 沒有被分類，請加進 permissionsMatrix.js').toEqual([]);
  });

  // ← codex 指出 v1 完全漏掉 route。這條就是補上的那半。
  it('每一支 API route handler 都必須在 matrix 中被分類', () => {
    const unclassified = [];
    for (const file of listRouteFiles()) {
      const src = readFileSync(file, 'utf8');
      for (const method of listRouteExports(src)) {
        if (EXEMPT.includes(`${file}#${method}`)) continue;
        if (!MATRIX[file]?.[method]) unclassified.push(`${file}#${method}`);
      }
    }
    expect(unclassified, '這些 route handler 沒有被分類，請加進 permissionsMatrix.js').toEqual([]);
  });

  it('每一支被分類的 action，第一個 statement 必須是對應的 withCap', () => {
    const bad = [];
    for (const [file, entries] of Object.entries(MATRIX)) {
      if (!file.startsWith(ACTIONS_DIR)) continue;
      const src = readFileSync(file, 'utf8');
      for (const [name, cap] of Object.entries(entries)) {
        if (!actionIsWrapped(src, name, cap)) bad.push(`${file}#${name} 應為 withCap('${cap}', …)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('每一支被分類的 route，必須是對應的 withRouteCap 產物', () => {
    const bad = [];
    for (const [file, entries] of Object.entries(MATRIX)) {
      if (!file.startsWith(API_DIR)) continue;
      const src = readFileSync(file, 'utf8');
      for (const [method, cap] of Object.entries(entries)) {
        if (!routeIsWrapped(src, method, cap)) bad.push(`${file}#${method} 應為 withRouteCap('${cap}', …)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('不得有任何 use server 模組 re-export 備份執行核心', () => {
    const leaks = [];
    for (const file of listActionFiles()) {
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      if (/export\s+\{[^}]*performBackup[^}]*\}/.test(src)) leaks.push(file);
      if (/^export\s+(async\s+)?function\s+cronBackup/m.test(src)) leaks.push(`${file}#cronBackup`);
    }
    expect(leaks).toEqual([]);
  });

  // fix round 1 finding 1：export default 對 listActionExports 的三條正則完全不匹配，
  // 連「未分類」都不會被抓到——這是該紅卻沒紅的靜默繞過，不是可接受的誤判。
  // 'use server' 檔的 default export 在呼叫端沒有名字，本來就無法納入授權 inventory，直接禁用。
  it('server action 檔不得使用 export default（無法被 inventory 追蹤）', () => {
    const offenders = [];
    for (const file of listActionFiles()) {
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      if (hasDefaultExport(src)) offenders.push(file);
    }
    expect(offenders, 'default export 在呼叫端沒有名字，無法納入授權 inventory').toEqual([]);
  });

  // fix round 2 finding 2：ACTIONS_DIR 是寫死的路徑，但 Next.js 判定 Server Action
  // 看的是檔案有沒有頂層 'use server'，跟目錄位置無關。把它放在 ACTIONS_DIR 之外，
  // 護欄的清點、withCap 檢查全部看不到——這條掃全部 src/ 堵住這個逃逸路徑。
  it("所有 'use server' 檔案都必須位於 src/server/actions/ 底下", () => {
    const strays = [];
    for (const file of listAllSrcFiles()) {
      const src = readFileSync(file, 'utf8');
      if (hasUseServerDirective(src) && !file.includes(`${ACTIONS_DIR}/`)) strays.push(file);
    }
    expect(strays, "use server 檔案放在 actions 目錄外會讓授權護欄看不到它").toEqual([]);
  });

  // ── 負向 fixture：證明掃描器自己會紅 ──
  // 每一條都呼叫「上面正式檢查用的同一個 helper」，不另寫 regex。
  describe('掃描器自我驗證', () => {
    const FIXTURE = [
      "'use server';",
      'export async function unclassifiedThing() { return db.insert(x).values({}); }',
      'export async function noGuardThing() { return db.update(x).set({}); }',
      'export async function deadBranchGuard() {',
      "  if (false) { return withCap('write', async () => {}); }",
      '  return db.delete(x);',
      '}',
      "export async function wrongCapThing() { return withCap('read', async () => db.insert(x)); }",
      "export async function goodThing() { return withCap('write', async () => db.insert(x)); }",
      // 下面這幾種是 v1 的 inventory / wrapper 判定抓不到的形式，補進來確認現在抓得到
      "export const arrowMutate = async (a) => db.insert(x).values(a);",
      'async function hiddenMutate() { return db.delete(x); }',
      'export { hiddenMutate };',
      "export async function selfShaped() { const result = await withCap('self', async () => 1); return result; }",
      // fix round 1 finding 3：inventory 說支援 const-arrow 形式，驗證卻只認 function 宣告——
      // 正確包了 withCap 的 const-arrow action 會被誤判成沒包，錯誤訊息還會誘導人開 EXEMPT 後門。
      "export const arrowGood = async (a) => withCap('write', async () => db.insert(x));",
      // fix round 2 finding 1：function 宣告裡裸呼叫 withCap（沒有 return/await）——
      // withCap 內部確實會檢查，但那個 Promise 被丟棄，呼叫端不會等它，
      // 後面的程式碼會在授權檢查完成前就先執行，是貨真價實的繞過。
      "export async function bareCall() { withCap('write', async () => {}); return db.insert(x); }",
    ].join('\n');

    const ROUTE_FIXTURE = [
      "export const POST = async (req) => { return doWrite(req); };",
      "export const GET = withRouteCap('export', async () => {});",
    ].join('\n');

    it('抓得到未分類的 export', () => {
      expect(listActionExports(FIXTURE)).toContain('unclassifiedThing');
    });

    it('抓得到沒有 withCap 的 export', () => {
      expect(actionIsWrapped(FIXTURE, 'noGuardThing', 'write')).toBe(false);
    });

    // 這條是 v1 假綠的那條——現在走正式 helper，真的驗證了死分支不算數
    it('抓得到 withCap 藏在死分支（第一個 statement 不是 withCap）', () => {
      expect(actionIsWrapped(FIXTURE, 'deadBranchGuard', 'write')).toBe(false);
    });

    it('抓得到 cap 與 matrix 不符', () => {
      expect(actionIsWrapped(FIXTURE, 'wrongCapThing', 'write')).toBe(false);
    });

    it('正確包裝的會通過（避免規則嚴到全部誤判）', () => {
      expect(actionIsWrapped(FIXTURE, 'goodThing', 'write')).toBe(true);
    });

    // ← codex 指出 v1 只抓 `export async function`，這兩種形式可以無聲繞過 inventory
    it('抓得到 export const 形式的 action', () => {
      expect(listActionExports(FIXTURE)).toContain('arrowMutate');
    });

    it('抓得到 export { name } 形式的 action', () => {
      expect(listActionExports(FIXTURE)).toContain('hiddenMutate');
    });

    it('接受 const result = await withCap(...) 形式（setPassword 用的）', () => {
      expect(actionIsWrapped(FIXTURE, 'selfShaped', 'self')).toBe(true);
      expect(actionIsWrapped(FIXTURE, 'selfShaped', 'write')).toBe(false); // cap 不符仍要判紅
    });

    // fix round 1 finding 3：inventory 抓得到 const-arrow 形式，但 v1 的 actionIsWrapped
    // 只認得 function 宣告——正確包了 withCap 的 const-arrow action 會被誤判成沒包。
    it('const-arrow 形式且正確包了 withCap → 判定為已包', () => {
      expect(actionIsWrapped(FIXTURE, 'arrowGood', 'write')).toBe(true);
      expect(actionIsWrapped(FIXTURE, 'arrowGood', 'read')).toBe(false); // cap 不符仍要判紅
    });

    // fix round 1 finding 1：export default 對三條 inventory 正則完全不匹配，
    // 連「未分類」都不會被抓到——這是該紅卻沒紅的靜默繞過。
    // fix round 2：改呼叫 hasDefaultExport（正式檢查用的同一支），
    // 上一輪把 regex 寫死在測試裡驗自己是恆真句，正式那條被改壞也測不出來。
    it('抓得到 export default（不得使用）', () => {
      const FX = 'export default async function evil() { return db.delete(x); }';
      expect(hasDefaultExport(FX)).toBe(true);
      expect(hasDefaultExport("export async function ok() { return withCap('write', async () => {}); }")).toBe(false);
    });

    // fix round 2 finding 1：裸呼叫 withCap（結果被丟棄）不算已包——
    // withCap 回傳的 Promise 沒被 return/await，呼叫端不會等它，
    // 後面的程式碼會在授權檢查完成前就先無授權執行。
    it('裸呼叫 withCap（結果被丟棄）不算已包——後面的程式碼會無授權執行', () => {
      expect(actionIsWrapped(FIXTURE, 'bareCall', 'write')).toBe(false);
    });

    // 端到端：未分類的 export 走完整比對流程後必須報錯，不能只驗 helper
    it('未分類的 export 走完整比對後會被列出來', () => {
      const MATRIX_FIXTURE = { 'fake.js': { goodThing: 'write' } };
      const unclassified = listActionExports(FIXTURE)
        .filter(n => !MATRIX_FIXTURE['fake.js'][n]);
      expect(unclassified).toEqual(
        expect.arrayContaining(['unclassifiedThing', 'arrowMutate', 'hiddenMutate'])
      );
    });

    it('抓得到沒包 withRouteCap 的 route handler', () => {
      expect(routeIsWrapped(ROUTE_FIXTURE, 'POST', 'write')).toBe(false);
      expect(routeIsWrapped(ROUTE_FIXTURE, 'GET', 'export')).toBe(true);
    });

    // fix wave finding B2-1：listActionFiles 只收 .js，src/server/actions/evil.jsx
    // 開頭寫 'use server' 會完全不在 inventory 掃描範圍內。
    describe('B2-1 listActionFiles 必須抓到 .jsx/.mjs/.ts/.tsx', () => {
      let tmpDir;
      afterEach(() => {
        if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = undefined;
      });

      it('抓得到非 .js 副檔名的 action 檔', () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'authz-fixture-'));
        writeFileSync(join(tmpDir, 'evil.jsx'), "'use server';\nexport async function evilThing() { return db.delete(x); }");
        writeFileSync(join(tmpDir, 'normal.js'), "'use server';\nexport async function ok() { return withCap('write', async () => {}); }");
        const found = listActionFiles(tmpDir);
        expect(found).toContain('evil.jsx');
        expect(found).toContain('normal.js');
      });
    });

    // fix wave finding B2-2：Next.js 的 route handler 也支援 OPTIONS/HEAD，
    // v1 的 listRouteExports 沒抓，這兩個 method 可以無聲繞過 inventory。
    it('抓得到 OPTIONS 與 HEAD route handler', () => {
      const FX = [
        "export const OPTIONS = withRouteCap('write', async () => {});",
        'export async function HEAD(req) { return new Response(null); }',
      ].join('\n');
      expect(listRouteExports(FX)).toEqual(expect.arrayContaining(['OPTIONS', 'HEAD']));
    });

    // fix wave finding B2-3：委派形狀 (b) 只找函式體內第一個 `return X(`，不檢查
    // return 之前有沒有東西。`await db.delete(...)` 在委派之前執行，等於業務邏輯
    // 已經在授權檢查之前跑完了。
    it('委派前出現 db. 或 await 時，不得判定為已包（即使委派目標有 withRouteCap）', () => {
      const EVIL_ROUTE_FIXTURE = [
        'export async function POST(req) {',
        '  await db.delete(tasks);',
        '  return h(req);',
        '}',
        "const h = withRouteCap('write', async () => {});",
      ].join('\n');
      expect(routeAssignmentOf(EVIL_ROUTE_FIXTURE, 'POST')).toBeNull();
      expect(routeIsWrapped(EVIL_ROUTE_FIXTURE, 'POST', 'write')).toBe(false);
    });

    it('委派前沒有 db./await 的合法形狀（如 /api/debug）仍判定為已包', () => {
      const OK_ROUTE_FIXTURE = [
        'export async function GET(request, ctx) {',
        "  if (process.env.NODE_ENV === 'production') {",
        "    return NextResponse.json({ error: 'Not available' }, { status: 404 });",
        '  }',
        '  return debugHandler(request, ctx);',
        '}',
        "const debugHandler = withRouteCap('manage', async () => {});",
      ].join('\n');
      expect(routeIsWrapped(OK_ROUTE_FIXTURE, 'GET', 'manage')).toBe(true);
    });

    // fix wave finding B2-4：hasUseServerDirective 只掃前 3 行，4 行版權註解後的
    // 'use server' 就隱形，讓「所有 use server 檔案都必須位於 actions 目錄下」那條測不到它。
    it('4 行註解區塊後的 use server 仍要被抓到', () => {
      const FX = [
        '// Copyright (c) 2026',
        '// All rights reserved.',
        '// Some more header comment',
        '// Yet another line',
        "'use server';",
        'export async function evilThing() { return db.delete(x); }',
      ].join('\n');
      expect(hasUseServerDirective(FX)).toBe(true);
    });
  });
});
