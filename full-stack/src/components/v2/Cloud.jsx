"use client";
import { useId, useMemo } from "react";
import { CLOUD_SVGS } from "@/lib/cloudAssets";
import { useCloudLevel } from "@/components/CloudLevelContext";
import { resolveCloudMotion } from "@/lib/personalSettings";
import { useV2Settings } from "./SettingsContext";

export const CLOUD_NAMES = { white: "白雲", pink: "粉紅雲", purple: "淡紫雲", dark: "烏雲", nimbus: "筋斗雲" };
// 雲關掉時的替代色點／色條顏色（css 變數名）
const CLOUD_COLOR = { white: "accent", pink: "pink", purple: "purple", dark: "red", nimbus: "green" };

// svg 內部 id（漸層、aria-labelledby）加尾碼：同頁多朵同款雲時 id 才不會互相覆蓋。
const uniqueIds = (raw, sfx) => raw
  .replace(/(\sid=")([^"]+)"/g, `$1$2-${sfx}"`)
  .replace(/url\(#([^)]+)\)/g, `url(#$1-${sfx})`)
  .replace(/(aria-labelledby=")([^"]+)"/g, (_, a, ids) => `${a}${ids.split(" ").map((i) => `${i}-${sfx}`).join(" ")}"`);

// 吃 CSS class（.cl／.bob／.fly 在 v2.css），尺寸走 --s；motion: 'bob' | 'fly'。
// level=off 不畫雲；deco（純裝飾）在 level=lite 也不畫——精簡只留頁首 Logo／空狀態／載入／登入。
// 雲不畫時：fb='dot'|'bar' 補色點／色條（fc＝css 變數名，預設跟雲種類），沒給 fb 就整個不輸出。
// 動態另受個人設定 cloudMotion 控制（關＝不套 bob／fly）；系統「減少動態」由 v2.css 的 media query 一律停止（兩者取交集）。
export default function Cloud({ kind, size = 32, motion, delay, deco = false, fb, fc, title }) {
  const level = useCloudLevel();
  const { settings } = useV2Settings();
  if (!resolveCloudMotion(settings?.cloudMotion)) motion = undefined;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const raw = CLOUD_SVGS[kind];
  const html = useMemo(() => (raw ? uniqueIds(raw, uid) : ""), [raw, uid]);
  if (!raw) return null;
  if (level === "off" || (deco && level === "lite")) {
    return fb ? <span className={fb === "bar" ? "fb tbar" : "fb dot"} aria-hidden="true" style={{ "--c": `var(--${fc || CLOUD_COLOR[kind]})` }} /> : null;
  }
  return <span className={motion ? `cl ${motion}` : "cl"} aria-hidden="true" title={title} style={{ "--s": `${size}px`, ...(delay ? { animationDelay: delay } : null) }} dangerouslySetInnerHTML={{ __html: html }} />;
}
