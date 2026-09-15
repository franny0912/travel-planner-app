import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../lib/db.js'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Availability({ trip, member }) {
  const today = useMemo(() => new Date(ymd(new Date())), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [mine, setMine] = useState(() => new Set())
  const [allAvail, setAllAvail] = useState([])
  const [memberCount, setMemberCount] = useState(1)
  const [status, setStatus] = useState('') // '', 'saving', 'saved'
  const saveTimer = useRef(null)

  useEffect(() => {
    ;(async () => {
      const [avail, members] = await Promise.all([
        db.listAvailability(trip.id),
        db.listMembers(trip.id),
      ])
      setAllAvail(avail)
      setMemberCount(Math.max(members.length, 1))
      setMine(new Set(avail.filter((a) => a.member_id === member.id).map((a) => a.date)))
    })()
  }, [trip.id, member.id])

  // 各日期「有空人數」熱度
  const heat = useMemo(() => {
    const map = new Map()
    for (const a of allAvail) {
      if (!map.has(a.date)) map.set(a.date, new Set())
      map.get(a.date).add(a.member_id)
    }
    // 疊上自己目前（尚未存檔）的選擇
    const out = new Map()
    for (const [date, set] of map) out.set(date, new Set([...set]))
    for (const date of mine) {
      if (!out.has(date)) out.set(date, new Set())
      out.get(date).add(member.id)
    }
    // 移除自己在已載入資料裡、但現在取消勾選的日期
    for (const [date, set] of out) {
      if (set.has(member.id) && !mine.has(date)) set.delete(member.id)
    }
    return out
  }, [allAvail, mine, member.id])

  function scheduleSave(next) {
    setStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await db.setAvailability(trip.id, member.id, [...next])
      // 重新拉全員資料，讓熱度反映最新
      setAllAvail(await db.listAvailability(trip.id))
      setStatus('saved')
      setTimeout(() => setStatus(''), 1200)
    }, 600)
  }

  function toggle(dateStr) {
    setMine((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      scheduleSave(next)
      return next
    })
  }

  const cells = useMemo(() => buildMonth(cursor), [cursor])

  return (
    <div>
      <p className="muted">
        點一下日期＝我這天有空。可跨月填寫，會自動儲存。格子上的數字是「目前有幾個人這天有空」。
      </p>

      <div className="cal-toolbar">
        <button className="btn ghost small" onClick={() => setCursor(addMonth(cursor, -1))}>
          ‹ 上個月
        </button>
        <strong>
          {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
        </strong>
        <button className="btn ghost small" onClick={() => setCursor(addMonth(cursor, 1))}>
          下個月 ›
        </button>
        <span className="save-status">
          {status === 'saving' && '儲存中…'}
          {status === 'saved' && '已儲存 ✓'}
        </span>
      </div>

      <div className="calendar">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="cal-cell empty" />
          const dateStr = ymd(cell)
          const isPast = cell < today
          const selected = mine.has(dateStr)
          const count = heat.get(dateStr)?.size ?? 0
          const others = count - (selected ? 1 : 0)
          return (
            <button
              key={i}
              className={
                'cal-cell' + (selected ? ' selected' : '') + (isPast ? ' past' : '')
              }
              disabled={isPast}
              onClick={() => toggle(dateStr)}
              title={`${count} 人有空 / 共 ${memberCount} 人`}
            >
              <span className="cal-day">{cell.getDate()}</span>
              {count > 0 && (
                <span className={'cal-count' + (others === 0 && selected ? ' solo' : '')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function addMonth(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

// 回傳含前置空白的當月格子陣列（Date 或 null）
function buildMonth(cursor) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}
