import { useEffect, useState, useCallback } from 'react'
import { db } from '../lib/db.js'

export default function Destinations({ trip, member }) {
  const [destinations, setDestinations] = useState([])
  const [myOrder, setMyOrder] = useState([]) // destination_id 陣列，依我的志願序
  const [newName, setNewName] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const [dests, prefs] = await Promise.all([
      db.listDestinations(trip.id),
      db.listPreferences(trip.id),
    ])
    setDestinations(dests)
    const mine = prefs
      .filter((p) => p.member_id === member.id)
      .sort((a, b) => a.rank - b.rank)
      .map((p) => p.destination_id)
      // 濾掉已被刪除的目的地
      .filter((id) => dests.some((d) => d.id === id))
    setMyOrder(mine)
  }, [trip.id, member.id])

  useEffect(() => {
    load()
  }, [load])

  async function saveOrder(order) {
    setMyOrder(order)
    setStatus('saving')
    await db.setPreferences(trip.id, member.id, order)
    setStatus('saved')
    setTimeout(() => setStatus(''), 1200)
  }

  async function addDestination(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    await db.addDestination(trip.id, name, member.nickname)
    setNewName('')
    await load()
  }

  async function removeDestination(id) {
    await db.removeDestination(id)
    await saveOrder(myOrder.filter((x) => x !== id))
    await load()
  }

  const nameOf = (id) => destinations.find((d) => d.id === id)?.name ?? '（已刪除）'
  const notRanked = destinations.filter((d) => !myOrder.includes(d.id))

  function move(idx, delta) {
    const next = [...myOrder]
    const j = idx + delta
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    saveOrder(next)
  }

  return (
    <div className="dest-layout">
      <section className="card">
        <h3>想去的地方（大家共用）</h3>
        <form onSubmit={addDestination} className="row-form">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入國家或城市，例如：日本 京都"
          />
          <button className="btn primary small">新增</button>
        </form>
        {destinations.length === 0 ? (
          <p className="muted small">還沒有人提議地點，先新增一個吧。</p>
        ) : (
          <ul className="dest-list">
            {destinations.map((d) => (
              <li key={d.id}>
                <span>{d.name}</span>
                <span className="muted small">由 {d.created_by} 提議</span>
                <button className="linklike danger" onClick={() => removeDestination(d.id)}>
                  刪除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>
          我的志願序 <span className="save-status">{status === 'saving' ? '儲存中…' : status === 'saved' ? '已儲存 ✓' : ''}</span>
        </h3>
        <p className="muted small">把想去的加進來，再用箭頭調整順序（第 1 名 = 最想去）。</p>

        {myOrder.length === 0 ? (
          <p className="muted small">尚未排志願序。</p>
        ) : (
          <ol className="rank-list">
            {myOrder.map((id, idx) => (
              <li key={id}>
                <span className="rank-num">{idx + 1}</span>
                <span className="rank-name">{nameOf(id)}</span>
                <span className="rank-actions">
                  <button className="btn ghost tiny" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    ↑
                  </button>
                  <button
                    className="btn ghost tiny"
                    onClick={() => move(idx, 1)}
                    disabled={idx === myOrder.length - 1}
                  >
                    ↓
                  </button>
                  <button className="linklike danger" onClick={() => saveOrder(myOrder.filter((x) => x !== id))}>
                    移除
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}

        {notRanked.length > 0 && (
          <div className="add-rank">
            <p className="muted small">尚未加入我的志願：</p>
            <div className="chips">
              {notRanked.map((d) => (
                <button key={d.id} className="chip" onClick={() => saveOrder([...myOrder, d.id])}>
                  + {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
