// AI 彙整建議：呼叫 Supabase Edge Function（見 supabase/functions/ai-suggest）。
// Claude 金鑰放在後端，不會出現在前端。

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const overrideUrl = import.meta.env.VITE_AI_FUNCTION_URL

function functionUrl() {
  if (overrideUrl) return overrideUrl
  if (supabaseUrl) return `${supabaseUrl}/functions/v1/ai-suggest`
  return null
}

export const aiConfigured = Boolean(functionUrl())

// payload: { tripName, members, topDates, topDestinations, weather }
// 回傳 { text } 或 { error }
export async function getAiSuggestion(payload) {
  const url = functionUrl()
  if (!url) {
    return {
      error:
        'AI 尚未設定。請先建立 Supabase 專案並部署 ai-suggest Edge Function（見 README 的 AI 設定章節）。',
    }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || `AI 服務錯誤 ${res.status}` }
    return { text: data.text }
  } catch (e) {
    return { error: e.message }
  }
}
