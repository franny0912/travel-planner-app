import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../lib/db.js'
import { getSessionMember, setSessionMember, clearSessionMember } from '../lib/session.js'
import Availability from '../features/Availability.jsx'
import Destinations from '../features/Destinations.jsx'
import Summary from '../features/Summary.jsx'

export default function Trip() {
  const { code } = useParams()
  const [trip, setTrip] = useState(null)
  const [member, setMember] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('time')
  const [nickname, setNickname] = useState('')
  const [copied, setCopied] = useState(false)

  const refreshMembers = useCallback(async (tripId) => {
    setMembers(await db.listMembers(tripId))
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const t = await db.getTripByCode(code)
        if (!alive) return
        if (!t) {
          setNotFound(true)
          return
        }
        setTrip(t)
        await refreshMembers(t.id)
        const saved = getSessionMember(t.id)
        if (saved) setMember({ id: saved.memberId, nickname: saved.nickname })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [code, refreshMembers])

  async function handleJoin(e) {
    e.preventDefault()
    const name = nickname.trim()
    if (!name || !trip) return
    const m = await db.joinTrip(trip.id, name)
    setSessionMember(trip.id, m)
    setMember(m)
    await refreshMembers(trip.id)
  }

  function switchMember() {
    if (trip) clearSessionMember(trip.id)
    setMember(null)
    setNickname('')
  }

  async function copyInvite() {
    const text = `${window.location.origin}${window.location.pathname}#/trip/${trip.code}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪貼簿不可用時忽略 */
    }
  }

  if (loading) return <p className="muted">載入中…</p>
  if (notFound) return <p className="error">找不到這個揪團（邀請碼：{code}）。</p>

  // 尚未表明身分 → 先輸入暱稱
  if (!member) {
    return (
      <div className="card narrow">
        <h2>{trip.name}</h2>
        <p className="muted">先告訴大家你是誰，就能開始填囉。</p>
        <form onSubmit={handleJoin} className="form">
          <label>
            你的暱稱
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例如：小明"
              autoFocus
            />
          </label>
          <button className="btn primary">進入揪團</button>
        </form>
        {members.length > 0 && (
          <p className="muted small">
            已加入：{members.map((m) => m.nickname).join('、')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="trip">
      <div className="trip-header">
        <div>
          <h2>{trip.name}</h2>
          <p className="muted small">
            你是 <strong>{member.nickname}</strong>　·
            成員（{members.length}）：{members.map((m) => m.nickname).join('、')}
            　·　<button className="linklike" onClick={switchMember}>切換身分</button>
          </p>
        </div>
        <div className="invite">
          <span className="muted small">邀請碼</span>
          <code className="code-chip">{trip.code}</code>
          <button className="btn ghost small" onClick={copyInvite}>
            {copied ? '已複製 ✓' : '複製邀請連結'}
          </button>
        </div>
      </div>

      <nav className="tabs">
        <button className={tab === 'time' ? 'tab active' : 'tab'} onClick={() => setTab('time')}>
          🗓️ 我的時段
        </button>
        <button className={tab === 'dest' ? 'tab active' : 'tab'} onClick={() => setTab('dest')}>
          🌍 目的地與志願序
        </button>
        <button className={tab === 'summary' ? 'tab active' : 'tab'} onClick={() => setTab('summary')}>
          📊 彙整看板
        </button>
      </nav>

      <div className="tab-panel">
        {tab === 'time' && <Availability trip={trip} member={member} />}
        {tab === 'dest' && <Destinations trip={trip} member={member} />}
        {tab === 'summary' && <Summary trip={trip} members={members} />}
      </div>
    </div>
  )
}
