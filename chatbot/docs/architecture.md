# Dawin Dash Chatbot

LINE + Telegram AI Chatbot，透過 Dawin Dash REST API 存取專案資料。
內部團隊可直接在聊天中查詢進度、建立任務、接收日報/週報。

---

## 架構

```
LINE 用戶 ──webhook──┐
                     ▼
Telegram 用戶 ─────→ Python Bot (Railway)
                     │
                     ├── Claude API (tool use)
                     │   └── 理解意圖 → 決定呼叫哪些 tools → 整理回覆
                     │
                     ├── Dawin Dash REST API (Vercel)
                     │   └── /api/mcp/* → Neon DB
                     │
                     ├── APScheduler
                     │   └── 每天 09:00 日報 / 每週一 09:00 週報
                     │
                     └── 回覆至 LINE / Telegram
```

## 技術棧

| 項目 | 技術 |
|------|------|
| 語言 | Python 3.12 |
| Web 框架 | FastAPI + Uvicorn |
| AI | Anthropic Claude API（tool use 模式） |
| LINE | line-bot-sdk |
| Telegram | python-telegram-bot |
| HTTP client | httpx（async） |
| 排程 | APScheduler |
| 部署 | Railway（$5/月） |

## 目錄結構

```
chatbot/
├── pyproject.toml          ← 依賴管理
├── Dockerfile              ← Railway 部署
├── .env                    ← API keys（不 commit）
├── app/
│   ├── main.py             ← FastAPI 入口（webhook endpoints + scheduler 啟動）
│   ├── config.py           ← 環境變數載入（pydantic-settings）
│   ├── api_client.py       ← Dawin Dash REST API 呼叫封裝
│   ├── agent/
│   │   ├── core.py         ← Claude AI Agent 主邏輯
│   │   └── tools.py        ← Agent tools 定義（對應 REST API）
│   ├── platforms/
│   │   ├── line.py         ← LINE webhook handler
│   │   └── telegram.py     ← Telegram webhook handler
│   ├── reports/
│   │   ├── generator.py    ← 日報/週報內容生成
│   │   └── scheduler.py    ← APScheduler 定時排程
│   └── utils/
│       └── formatter.py    ← 訊息格式化（Markdown → LINE/TG 格式）
└── README.md
```

## Bot 功能

### 1. AI 對話查資料

用戶用自然語言提問，Claude 理解意圖後呼叫 REST API 查詢：

```
用戶：海賊王劇場版進度怎樣？
Bot：📊 海賊王劇場版
     整體進度：65%（13/20 子任務完成）
     進行中：5 個任務
     逾期：1 個（「聯繫配音演員」逾期 3 天）
```

### 2. AI Agent 自主操作

用戶下達指令，Claude 判斷要呼叫哪些 API 並執行：

```
用戶：幫我在海賊王專案建一個任務「場地確認」，負責人小王，優先高
Bot：✅ 已建立任務
     專案：海賊王劇場版
     任務：場地確認
     負責人：小王
     優先級：高
     狀態：待辦
```

### 3. 定時日報/週報

每天/每週自動發送到群組：

```
📋 日報 — 2026/03/22

📊 整體進度：65%
✅ 今日完成：3 個子任務
⚠️ 逾期任務：1 個
📅 未來 7 天到期：4 個任務

各專案進度：
  海賊王劇場版  ████████░░ 80%
  鬼滅之刃聯名  ██████░░░░ 60%
  進擊的巨人展  ████░░░░░░ 40%
```

### 4. 手動觸發報告

```
用戶：給我今天的日報
Bot：（即時生成並回覆日報內容）

用戶：這週的週報呢？
Bot：（即時生成並回覆週報內容）
```

## AI Agent 設計

### Claude Tool Use 流程

```
用戶訊息
    ↓
Claude API (messages + tools 定義)
    ↓
Claude 回傳 tool_use → 執行 tool（呼叫 REST API）→ 回傳結果
    ↓
（可能多輪 tool use）
    ↓
Claude 回傳最終 text 回覆
    ↓
格式化 → 發送至 LINE / Telegram
```

### Agent Tools

| Tool | REST API | 說明 |
|------|---------|------|
| list_projects | GET /api/mcp/projects | 列出所有專案 |
| get_project | GET /api/mcp/projects/:id | 取得專案含任務 |
| create_project | POST /api/mcp/projects | 建立專案 |
| list_tasks | GET /api/mcp/tasks | 列出/篩選任務 |
| create_task | POST /api/mcp/tasks | 建立任務 |
| update_task | PATCH /api/mcp/tasks/:id | 更新任務 |
| delete_task | DELETE /api/mcp/tasks/:id | 刪除任務 |
| create_subtask | POST /api/mcp/subtasks | 建立子任務 |
| update_subtask | PATCH /api/mcp/subtasks/:id | 更新/完成子任務 |
| get_dashboard | GET /api/mcp/dashboard | 全域統計 |
| daily_report | GET /api/mcp/reports/daily | 日報數據 |
| weekly_report | GET /api/mcp/reports/weekly | 週報數據 |
| search_tasks | GET /api/mcp/search | 搜尋任務 |

### System Prompt 設計

```
你是 Dawin Dash 專案管理助手，服務一個影視 IP 團隊。
你可以查詢專案進度、建立/更新/刪除任務、生成報告。
回覆使用繁體中文，保持簡潔。
當用戶問到進度相關問題時，優先使用 get_dashboard 或 get_project 工具。
當用戶要求建立/修改資料時，先確認關鍵資訊再執行。
```

## 日報/週報排程

```python
# 每天台北時間 09:00
scheduler.add_job(send_daily_report, 'cron', hour=9, minute=0, timezone='Asia/Taipei')

# 每週一台北時間 09:00
scheduler.add_job(send_weekly_report, 'cron', day_of_week='mon', hour=9, minute=0, timezone='Asia/Taipei')
```

**生成流程**：
1. 呼叫 `GET /api/mcp/reports/daily` 取得原始數據
2. 丟給 Claude API 整理成簡潔中文報告
3. 格式化為 LINE Flex Message / Telegram Markdown
4. 發送至設定的群組

## 環境變數

| 變數 | 用途 | 如何取得 |
|------|------|---------|
| `ANTHROPIC_API_KEY` | Claude API | console.anthropic.com |
| `DAWIN_API_URL` | REST API URL | 你的 Vercel 部署網址 |
| `DAWIN_API_KEY` | REST API Key | 與 Vercel 的 MCP_API_KEY 相同 |
| `LINE_CHANNEL_SECRET` | LINE 驗證 | LINE Developers Console |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE 發訊 | LINE Developers Console |
| `TELEGRAM_BOT_TOKEN` | TG Bot | @BotFather |
| `REPORT_LINE_GROUP_ID` | 日報 LINE 群組 | LINE group ID |
| `REPORT_TELEGRAM_CHAT_ID` | 日報 TG 群組 | Telegram chat ID |

## 部署

### Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install .
COPY app/ app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Railway 部署步驟

1. 建立 Railway 專案，連接 GitHub repo
2. 設定環境變數（Railway dashboard 或 CLI）
3. 部署後取得 URL（如 `https://chatbot-xxx.up.railway.app`）
4. 設定 LINE webhook URL：`https://chatbot-xxx.up.railway.app/webhook/line`
5. 設定 Telegram webhook：`https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://chatbot-xxx.up.railway.app/webhook/telegram`

### 本地開發

```bash
cd chatbot
pip install -e .
cp .env.example .env  # 填入 API keys
uvicorn app.main:app --reload --port 8000
```

## API 規格

REST API 完整規格請參考 `full-stack/api-spec.md`。
