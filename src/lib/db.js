import { supabase, hasSupabase } from './supabase.js'

// 統一的資料層介面：不論後端是 Supabase 還是 localStorage，UI 都呼叫同一組函式。
// 所有函式皆為 async，回傳 Promise。

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    's' + Math.random().toString(36).slice(2) + Date.now().toString(36))

// 產生易讀、不含易混淆字元的 6 碼邀請碼
export function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

/* ------------------------------------------------------------------ */
/*  localStorage 後備實作                                              */
/* ------------------------------------------------------------------ */

const LS_KEY = 'travel_planner_db_v1'

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return emptyDb()
    return { ...emptyDb(), ...JSON.parse(raw) }
  } catch {
    return emptyDb()
  }
}

function emptyDb() {
  return { trips: [], members: [], availability: [], destinations: [], preferences: [] }
}

function lsWrite(db) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('localStorage 寫入失敗', e)
  }
}

const localBackend = {
  async createTrip(name) {
    const db = lsRead()
    const trip = { id: uid(), code: makeInviteCode(), name, created_at: new Date().toISOString() }
    db.trips.push(trip)
    lsWrite(db)
    return trip
  },
  async getTripByCode(code) {
    const db = lsRead()
    return db.trips.find((t) => t.code === code.toUpperCase()) ?? null
  },
  async getTrip(tripId) {
    const db = lsRead()
    return db.trips.find((t) => t.id === tripId) ?? null
  },
  async joinTrip(tripId, nickname) {
    const db = lsRead()
    let member = db.members.find((m) => m.trip_id === tripId && m.nickname === nickname)
    if (!member) {
      member = { id: uid(), trip_id: tripId, nickname, created_at: new Date().toISOString() }
      db.members.push(member)
      lsWrite(db)
    }
    return member
  },
  async listMembers(tripId) {
    const db = lsRead()
    return db.members.filter((m) => m.trip_id === tripId)
  },
  async listAvailability(tripId) {
    const db = lsRead()
    return db.availability.filter((a) => a.trip_id === tripId)
  },
  async setAvailability(tripId, memberId, dates) {
    const db = lsRead()
    db.availability = db.availability.filter(
      (a) => !(a.trip_id === tripId && a.member_id === memberId),
    )
    for (const date of dates) {
      db.availability.push({ id: uid(), trip_id: tripId, member_id: memberId, date })
    }
    lsWrite(db)
    return true
  },
  async listDestinations(tripId) {
    const db = lsRead()
    return db.destinations.filter((d) => d.trip_id === tripId)
  },
  async addDestination(tripId, name, createdBy) {
    const db = lsRead()
    const dest = {
      id: uid(),
      trip_id: tripId,
      name,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    }
    db.destinations.push(dest)
    lsWrite(db)
    return dest
  },
  async removeDestination(destId) {
    const db = lsRead()
    db.destinations = db.destinations.filter((d) => d.id !== destId)
    db.preferences = db.preferences.filter((p) => p.destination_id !== destId)
    lsWrite(db)
    return true
  },
  async listPreferences(tripId) {
    const db = lsRead()
    return db.preferences.filter((p) => p.trip_id === tripId)
  },
  async setPreferences(tripId, memberId, orderedDestIds) {
    const db = lsRead()
    db.preferences = db.preferences.filter(
      (p) => !(p.trip_id === tripId && p.member_id === memberId),
    )
    orderedDestIds.forEach((destId, idx) => {
      db.preferences.push({
        id: uid(),
        trip_id: tripId,
        member_id: memberId,
        destination_id: destId,
        rank: idx + 1,
      })
    })
    lsWrite(db)
    return true
  },
}

/* ------------------------------------------------------------------ */
/*  Supabase 實作                                                      */
/* ------------------------------------------------------------------ */

function must(res) {
  if (res.error) throw res.error
  return res.data
}

const supabaseBackend = {
  async createTrip(name) {
    // 重試以避免邀請碼碰撞（極低機率）
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeInviteCode()
      const res = await supabase.from('trips').insert({ name, code }).select().single()
      if (!res.error) return res.data
      if (res.error.code !== '23505') throw res.error // 23505 = unique violation
    }
    throw new Error('無法產生邀請碼，請再試一次')
  },
  async getTripByCode(code) {
    const res = await supabase
      .from('trips')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle()
    return must(res)
  },
  async getTrip(tripId) {
    const res = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle()
    return must(res)
  },
  async joinTrip(tripId, nickname) {
    const existing = await supabase
      .from('members')
      .select('*')
      .eq('trip_id', tripId)
      .eq('nickname', nickname)
      .maybeSingle()
    if (existing.data) return existing.data
    const res = await supabase
      .from('members')
      .insert({ trip_id: tripId, nickname })
      .select()
      .single()
    return must(res)
  },
  async listMembers(tripId) {
    return must(await supabase.from('members').select('*').eq('trip_id', tripId))
  },
  async listAvailability(tripId) {
    return must(await supabase.from('availability').select('*').eq('trip_id', tripId))
  },
  async setAvailability(tripId, memberId, dates) {
    await supabase.from('availability').delete().eq('trip_id', tripId).eq('member_id', memberId)
    if (dates.length) {
      must(
        await supabase
          .from('availability')
          .insert(dates.map((date) => ({ trip_id: tripId, member_id: memberId, date }))),
      )
    }
    return true
  },
  async listDestinations(tripId) {
    return must(await supabase.from('destinations').select('*').eq('trip_id', tripId))
  },
  async addDestination(tripId, name, createdBy) {
    return must(
      await supabase
        .from('destinations')
        .insert({ trip_id: tripId, name, created_by: createdBy })
        .select()
        .single(),
    )
  },
  async removeDestination(destId) {
    await supabase.from('preferences').delete().eq('destination_id', destId)
    must(await supabase.from('destinations').delete().eq('id', destId))
    return true
  },
  async listPreferences(tripId) {
    return must(await supabase.from('preferences').select('*').eq('trip_id', tripId))
  },
  async setPreferences(tripId, memberId, orderedDestIds) {
    await supabase.from('preferences').delete().eq('trip_id', tripId).eq('member_id', memberId)
    if (orderedDestIds.length) {
      must(
        await supabase.from('preferences').insert(
          orderedDestIds.map((destId, idx) => ({
            trip_id: tripId,
            member_id: memberId,
            destination_id: destId,
            rank: idx + 1,
          })),
        ),
      )
    }
    return true
  },
}

export const db = hasSupabase ? supabaseBackend : localBackend
export const backendName = hasSupabase ? 'supabase' : 'local'
