// 記住「這台裝置在某個揪團裡是誰」，讓使用者不必每次重填暱稱。

const KEY = 'travel_planner_session_v1'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function write(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj))
  } catch (e) {
    console.warn('session 寫入失敗', e)
  }
}

// 以 tripId 為 key 記住 { memberId, nickname }
export function getSessionMember(tripId) {
  return read()[tripId] ?? null
}

export function setSessionMember(tripId, member) {
  const all = read()
  all[tripId] = { memberId: member.id, nickname: member.nickname }
  write(all)
}

export function clearSessionMember(tripId) {
  const all = read()
  delete all[tripId]
  write(all)
}
