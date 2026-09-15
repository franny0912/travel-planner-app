# ✈️ 一起去旅遊 · 揪團規劃

和朋友一起規劃旅遊的小工具：大家各自填「有空的時間」和「想去的國家＋志願序」，
系統幫你們**彙整重疊時段、熱門目的地**，再附上**天氣**與 **AI 建議**，討論起來更有依據。

> 不需要即時投票 —— 大家可以慢慢填、隨時修改，打開彙整看板就能看到最新結果。

## 功能

- 🧑‍🤝‍🧑 **暱稱 + 邀請碼**加入揪團（免註冊、免驗證信箱）
- 🗓️ **時段月曆**：點選自己有空的日期，看到每天有幾個人有空
- 🌍 **目的地清單 + 志願序**：大家共同提議地點，各自拖曳排出想去的順序
- 📊 **彙整看板**：重疊時段排行、熱門目的地（志願序加權 Borda 計分）
- 🌤️ **天氣**：熱門目的地在建議區間的天氣（Open-Meteo，免金鑰）
- 🤖 **AI 建議**：Claude 綜合時間／票數／天氣，推薦目的地與行程方向
- 🎫 機票：先以「自己查」連結佔位（不爬 Skyscanner，改用合法方式，日後再串 API）

> 💡 **不想碰 Vercel / Supabase？** 另有一份 **Google Apps Script 版**（資料存你自己的
> Google 試算表，部署成網頁 App 即可分享），見 [`apps-script/`](apps-script/README.md)。

## 技術架構

- 前端：**React + Vite**（純前端，可部署為靜態網站）
- 資料：**Supabase**（Postgres）；**未設定時自動改用瀏覽器 localStorage**（單機模式）
- 天氣：**Open-Meteo**（免金鑰）
- AI：**Supabase Edge Function** 呼叫 **Claude API**（金鑰放後端）

```
src/
  lib/         資料層(db)、Supabase、天氣、AI、彙整計算、session
  pages/       Home（建立/加入）、Trip（揪團主頁 + 頁籤）
  features/    Availability（時段）、Destinations（目的地/志願序）、Summary（彙整看板）
supabase/
  schema.sql              資料表（貼到 Supabase SQL Editor 執行）
  functions/ai-suggest/   AI Edge Function
```

## 快速開始（本機，單機模式即可跑）

```bash
npm install
npm run dev
```

打開終端機顯示的網址即可使用。**不設定任何金鑰也能用**，資料存在瀏覽器
localStorage（只在你這台裝置、無法多人共享），畫面左上會顯示「單機模式」。

## 開啟多人共享（Supabase）

1. 到 <https://supabase.com> 免費建立專案。
2. 專案的 **SQL Editor** → 貼上並執行 `supabase/schema.sql`。
3. **Project Settings → API** 取得 `Project URL` 與 `anon public` key。
4. 複製 `.env.example` 為 `.env`，填入：
   ```
   VITE_SUPABASE_URL=你的_project_url
   VITE_SUPABASE_ANON_KEY=你的_anon_key
   ```
5. 重新 `npm run dev`（或重新 build）。左上「單機模式」標記消失即代表已連上。

> 安全性說明：此 App 沒有帳號登入，採「知道邀請碼即可存取」模式，因此 schema 對
> `anon` 角色開放讀寫。這是朋友間小工具的合理取捨；若日後要更嚴謹，可改為登入 +
> 依揪團成員限制存取。

## AI 設定（選填）

AI 建議透過 Supabase Edge Function 呼叫 Claude，金鑰放在後端。

```bash
# 安裝 Supabase CLI 後，於專案根目錄：
supabase functions deploy ai-suggest --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-你的金鑰
# 可選：改用較便宜的模型（預設 claude-opus-5）
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5
```

前端會自動用 `VITE_SUPABASE_URL` 組出函式網址；若你的函式網址不同，可在 `.env` 設
`VITE_AI_FUNCTION_URL` 覆寫。未設定 AI 時，其他功能仍可正常使用。

## 部署

`npm run build` 產生 `dist/`，可部署到任何靜態主機（Vercel、Netlify、Cloudflare
Pages、GitHub Pages…）。記得在該平台的環境變數設定 `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`。

## 尚未做（可日後擴充）

- 串接合法機票 API（Amadeus / Kiwi / SerpAPI）取代「自己查」連結
- 帳號登入與更嚴謹的權限
- 行程細節編輯（每日景點、住宿）
