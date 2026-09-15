// Supabase Edge Function：ai-suggest
// 接收前端彙整後的資料，呼叫 Claude 產生「目的地與行程建議」。
// Claude 金鑰放在後端環境變數，不會外流到前端。
//
// 部署方式（見專案 README 的「AI 設定」章節）：
//   supabase functions deploy ai-suggest --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// 可選：supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5   （預設 claude-opus-5）

import Anthropic from 'npm:@anthropic-ai/sdk@^0.68.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function buildPrompt(p: any): string {
  const dates = (p.topDates ?? [])
    .map((d: any) => `  - ${d.date}：${d.count} 人有空（${(d.who ?? []).join('、')}）`)
    .join('\n')
  const dests = (p.topDestinations ?? [])
    .map(
      (d: any) =>
        `  - ${d.name}：加權分 ${d.score}、${d.votes} 人投票` +
        (d.avgRank ? `、平均志願 ${Number(d.avgRank).toFixed(1)}` : ''),
    )
    .join('\n')
  const weather = Object.entries(p.weather ?? {})
    .filter(([, w]) => w)
    .map(([name, w]: any) => `  - ${name}：約 ${w.avgMin}~${w.avgMax}°C，${w.total} 天中約 ${w.rainDays} 天有雨`)
    .join('\n')

  const win = p.bestWindow
    ? `${p.bestWindow.start}${p.bestWindow.end && p.bestWindow.end !== p.bestWindow.start ? ' ~ ' + p.bestWindow.end : ''}（${p.bestWindow.count} 人皆有空）`
    : '尚未有明確重疊時段'

  return `你是一位貼心的旅遊規劃顧問。以下是一群朋友（共 ${p.memberCount ?? '?'} 人：${(p.members ?? []).join('、')}）為了「${p.tripName ?? '這趟旅行'}」所填的資料。請用繁體中文，幫他們做出實用的分析與建議。

【大家最有空的日期】
${dates || '  （尚無資料）'}
建議出遊區間：${win}

【最想去的地方（依志願序加權）】
${dests || '  （尚無資料）'}

【熱門目的地天氣（若有）】
${weather || '  （尚無資料）'}

請提供：
1. 綜合時間、票數與天氣，推薦 1~2 個最適合的目的地，並說明理由（特別點出天氣是否適合出遊）。
2. 針對推薦目的地，給出建議的出遊天數與 3~5 天的行程大方向（每天一句重點即可，不必太細）。
3. 一段給這群朋友的貼心提醒或討論建議（例如還需要確認什麼、如何取捨分歧）。

請用清楚的段落與條列，語氣輕鬆友善。不要杜撰資料中沒有的機票價格或確切航班。`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: '只接受 POST' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: '後端尚未設定 ANTHROPIC_API_KEY' }, 500)

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: '請求內容不是有效的 JSON' }, 400)
  }

  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-5'
  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 2000,
      output_config: { effort: 'low' }, // 輕量任務，控制成本與延遲
      messages: [{ role: 'user', content: buildPrompt(payload) }],
    })
    const text = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
    return json({ text })
  } catch (e: any) {
    return json({ error: 'Claude 呼叫失敗：' + (e?.message ?? String(e)) }, 502)
  }
})
