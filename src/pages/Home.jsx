import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db.js'

export default function Home() {
  const nav = useNavigate()
  const [tab, setTab] = useState('create')
  const [tripName, setTripName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!tripName.trim()) return
    setBusy(true)
    setError('')
    try {
      const trip = await db.createTrip(tripName.trim())
      nav(`/trip/${trip.code}`)
    } catch (err) {
      setError('建立失敗：' + err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    setBusy(true)
    setError('')
    try {
      const trip = await db.getTripByCode(c)
      if (!trip) {
        setError('找不到這個邀請碼，請確認是否輸入正確。')
        return
      }
      nav(`/trip/${trip.code}`)
    } catch (err) {
      setError('加入失敗：' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home">
      <section className="hero">
        <h1>和朋友一起規劃旅遊 🗺️</h1>
        <p>
          大家各自填「有空的時間」和「想去的國家＋志願序」，系統幫你們彙整重疊時段、熱門目的地，
          再附上天氣與 AI 建議 —— 討論起來更有依據。
        </p>
      </section>

      <div className="card">
        <div className="tabs">
          <button className={tab === 'create' ? 'tab active' : 'tab'} onClick={() => setTab('create')}>
            建立新揪團
          </button>
          <button className={tab === 'join' ? 'tab active' : 'tab'} onClick={() => setTab('join')}>
            用邀請碼加入
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="form">
            <label>
              揪團名稱
              <input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="例如：2026 春天的日本行"
                autoFocus
              />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? '建立中…' : '建立並取得邀請碼'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="form">
            <label>
              邀請碼
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="6 碼，例如 K7M2QP"
                maxLength={6}
                autoFocus
              />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? '查詢中…' : '前往揪團'}
            </button>
          </form>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
