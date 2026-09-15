# 一起去旅遊 · 揪團規劃（Google Apps Script 版）

和 React 版功能相同，但**不需要 Vercel、也不需要 Supabase**：資料存在你自己的
Google 試算表，整包部署成一個網頁 App 就有網址可以分享給朋友。

- 後端：Google Apps Script + 自動建立的 Google 試算表（當資料庫）
- 前端：HtmlService 提供單頁 App（原生 JS，免 build）
- 天氣：Open-Meteo（免金鑰），在伺服器端呼叫
- AI：Claude（選填），金鑰放 Apps Script 的「指令碼屬性」，不進前端
- 機票：先以「自己查」連結佔位（不爬 Skyscanner）

## 檔案

| 檔名 | 類型 | 說明 |
|---|---|---|
| `Code.gs` | 指令碼 | 後端：資料庫、API、天氣、AI |
| `Index.html` | HTML | 頁面骨架（include 樣式與前端 JS） |
| `Stylesheet.html` | HTML | 樣式 |
| `JavaScript.html` | HTML | 前端邏輯 |
| `appsscript.json` | 資訊清單 | 權限與 web app 設定 |

## 部署方式一：手動複製貼上（最簡單，約 10 分鐘）

1. 打開 <https://script.google.com> → **新專案**。
2. 把左邊預設的 `Code.gs` 內容換成本資料夾的 `Code.gs`。
3. **檔案 → +（新增）→ HTML**，依序建立三個 HTML 檔，名稱**必須完全一致**（不含 .html）：
   `Index`、`Stylesheet`、`JavaScript`，分別貼上對應內容。
4. 左側 **專案設定（齒輪）** → 勾選「**在編輯器中顯示 appsscript.json 資訊清單檔案**」。
   回到編輯器打開 `appsscript.json`，貼上本資料夾的 `appsscript.json` 內容。
5. 右上 **部署 → 新增部署作業 → 類型選「網頁應用程式」**：
   - 執行身分：**我**
   - 誰可以存取：**所有人**
   - 按「部署」，第一次會要求**授權**（允許存取試算表與外部服務）。
6. 完成後會得到一個網址（`https://script.google.com/macros/s/.../exec`）——這就是可分享的 App。
   第一次使用時會自動在你的雲端硬碟建立一份「**旅遊揪團資料**」試算表當資料庫。

> 每次修改程式後要「**部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選『新版本』→ 部署**」才會更新線上版本。

## 部署方式二：clasp（給熟悉 CLI 的人）

```bash
npm i -g @google/clasp
clasp login
clasp create --title "旅遊揪團" --type webapp
# 把本資料夾檔案複製進 clasp 專案目錄後：
clasp push
clasp deploy
```

## 開啟 AI 建議（選填）

1. 到 <https://console.anthropic.com> 申請 API 金鑰。
2. Apps Script **專案設定 → 指令碼屬性 → 新增屬性**：
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
   - （選填）`ANTHROPIC_MODEL` = `claude-sonnet-5`（預設 `claude-opus-5`）
3. 重新整理 App，AI 面板即可使用。

## 說明與限制

- 採「知道邀請碼即可存取」模式，沒有帳號登入。所有讀寫都以**部署者身分**在同一份試算表
  進行，因此朋友們看到的是同一份資料（適合小圈子共用）。
- 「切換身分／記住你是誰」用瀏覽器 localStorage，只在該裝置有效。
- Apps Script 有每日配額（一般個人帳號足夠朋友揪團使用）。天氣/AI 走伺服器端呼叫，
  已避開瀏覽器 CORS 問題。
