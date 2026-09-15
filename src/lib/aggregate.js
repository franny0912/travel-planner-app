// 把大家填的原始資料彙整成「重疊時段」與「熱門目的地（含志願序加權）」。

// availability: [{member_id, date}], members: [{id, nickname}]
// 回傳依「有空人數」由多到少排序的日期
export function rankDates(availability, members) {
  const byDate = new Map()
  for (const a of availability) {
    if (!byDate.has(a.date)) byDate.set(a.date, new Set())
    byDate.get(a.date).add(a.member_id)
  }
  const nameOf = Object.fromEntries(members.map((m) => [m.id, m.nickname]))
  const rows = [...byDate.entries()].map(([date, set]) => ({
    date,
    count: set.size,
    members: [...set].map((id) => nameOf[id]).filter(Boolean),
  }))
  rows.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
  return rows
}

// 找出「有空人數最多」的連續日期區間（供天氣查詢用）。
export function bestWindow(rankedDates) {
  if (!rankedDates.length) return null
  const maxCount = rankedDates[0].count
  const topDates = rankedDates
    .filter((d) => d.count === maxCount)
    .map((d) => d.date)
    .sort()
  // 從最高票日期中找一段連續區間
  let start = topDates[0]
  let end = topDates[0]
  for (let i = 1; i < topDates.length; i++) {
    const prev = new Date(topDates[i - 1])
    const cur = new Date(topDates[i])
    if ((cur - prev) / 86400000 === 1) {
      end = topDates[i]
    } else {
      break
    }
  }
  return { start, end, count: maxCount }
}

// preferences: [{member_id, destination_id, rank}], destinations: [{id, name}]
// 志願序加權（Borda）：某人排了 N 個，第 1 志願得 N 分、第 2 得 N-1 分…
export function rankDestinations(preferences, destinations, memberCount) {
  const prefsByMember = new Map()
  for (const p of preferences) {
    if (!prefsByMember.has(p.member_id)) prefsByMember.set(p.member_id, [])
    prefsByMember.get(p.member_id).push(p)
  }

  const score = new Map()
  const votes = new Map()
  const rankSum = new Map()

  for (const list of prefsByMember.values()) {
    const n = list.length
    for (const p of list) {
      score.set(p.destination_id, (score.get(p.destination_id) ?? 0) + (n - p.rank + 1))
      votes.set(p.destination_id, (votes.get(p.destination_id) ?? 0) + 1)
      rankSum.set(p.destination_id, (rankSum.get(p.destination_id) ?? 0) + p.rank)
    }
  }

  const rows = destinations.map((d) => {
    const v = votes.get(d.id) ?? 0
    return {
      id: d.id,
      name: d.name,
      score: score.get(d.id) ?? 0,
      votes: v,
      avgRank: v ? rankSum.get(d.id) / v : null,
    }
  })
  rows.sort((a, b) => b.score - a.score || b.votes - a.votes)
  return rows
}
