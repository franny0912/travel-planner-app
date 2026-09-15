# 部署指南（Vercel + Supabase）

照著做，約 10~15 分鐘就能上線，全程不需要把任何金鑰貼給別人。

## A. 建立 Supabase（資料庫）

1. 到 <https://supabase.com> 用 GitHub 登入 → **New project**。
2. 填專案名稱、設定一組資料庫密碼、選最近的區域（如 `Northeast Asia (Tokyo)`）→ 建立（等 1~2 分鐘）。
3. 左側 **SQL Editor** → **New query** → 打開本專案的 `supabase/schema.sql`，整段貼上 → **Run**。
   看到成功即建好資料表。
4. 左側 **Project Settings（齒輪）→ API**，記下兩個值：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public** key（很長一串）

## B. 部署到 Vercel（網站）

1. 到 <https://vercel.com> 用 GitHub 登入。
2. **Add New… → Project** → 匯入這個 repo `franny0912/travel-planner-app`。
3. Framework 會自動偵測為 **Vite**（本專案已附 `vercel.json`，不用改）。
4. 展開 **Environment Variables**，加入兩個變數（值填 A 步驟記下的）：
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | 你的 Project URL |
   | `VITE_SUPABASE_ANON_KEY` | 你的 anon public key |
5. **Deploy**。完成後會給你一個網址（形如 `https://travel-planner-app-xxx.vercel.app`）。
6. 打開網址，左上若**沒有**「單機模式」標記，代表已成功連上 Supabase、可多人共享。

> 之後每次 push 到 GitHub，Vercel 會自動重新部署。
> 若之後在 Vercel 改了環境變數，要到 **Deployments → 最新一筆 → Redeploy** 才會生效。

## C. 開啟 AI 建議（選填，需要 Claude 金鑰）

AI 建議透過 Supabase Edge Function 呼叫 Claude，金鑰放後端、不進前端。

1. 安裝 Supabase CLI：<https://supabase.com/docs/guides/cli>（例如 `npm i -g supabase`）。
2. 在本專案根目錄：
   ```bash
   supabase login
   supabase link --project-ref <你的專案ref>   # ref 就是 Project URL 裡的 xxxx
   supabase functions deploy ai-suggest --no-verify-jwt
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-你的金鑰
   # 可選：改用較省錢的模型（預設 claude-opus-5）
   supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5
   ```
3. 前端會自動用 `VITE_SUPABASE_URL` 組出函式網址，無需額外設定。
   Claude 金鑰請到 <https://console.anthropic.com> 申請。

## 常見問題

- **左上一直顯示「單機模式」**：代表前端沒讀到 Supabase 環境變數。確認 Vercel 的環境變數名稱是
  `VITE_` 開頭且拼寫正確，改完記得 **Redeploy**。
- **AI 按了說「尚未設定」**：C 步驟的 Edge Function 尚未部署或金鑰未設定。
- **想本機測多人共享**：把 A 的兩個值填進本機 `.env`（見 `.env.example`）再 `npm run dev`。
