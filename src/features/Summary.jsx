import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db.js'
import { rankDates, bestWindow, rankDestinations } from '../lib/aggregate.js'
import { getWeather, summarize, describeCode } from '../lib/weather.js'
import { getAiSuggestion, aiConfigured } from '../lib/ai.js'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
function fmtDate(s) {
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY[d.getDay()]}）`
}
function flightsLink(name) {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to ' + name)}`
}

export default function Summary({ trip, members }) {
  const [data, setData] = useState(null)
  const [weather, setWeather] = useState({}) // { [destName]: result }
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [ai, setAi] = useState({ text: '', error: '', busy: false })

  useEffect(() => {
    ;(async () => {
      const [availability, destinations, preferences] = await Promise.all([
        db.listAvailability(trip.id),
        db.listDestinations(trip.id),
        db.listPreferences(trip.id),
      ])
      setData({ availability, destinations, preferences })
    })()
  }, [trip.id, members.length])

  const computed = useMemo(() => {
    if (!data) return null
    const dates = rankDates(data.availability, members)
    const window = bestWindow(dates)
    const dests = rankDestinations(data.preferences, data.destinations, members.length)
    return { dates, window, dests }
  }, [data, members])

  const topDests = computed?.dests.filter((d) => d.votes > 0).slice(0, 3) ?? []

  async function loadWeather() {
    if (!computed?.window || topDests.length === 0) return
    setWeatherBusy(true)
    const { start, end } = computed.window
    const results = {}
    for (const d of topDests) {
      results[d.name] = await getWeather(d.name, start, end)
    }
    setWeather(results)
    setWeatherBusy(false)
  }

  async function askAi() {
    setAi({ text: '', error: '', busy: true })
    const payload = {
      tripName: trip.name,
      memberCount: members.length,
      members: members.map((m) => m.nickname),
      topDates: (computed?.dates ?? []).slice(0, 5).map((d) => ({
        date: d.date,
        count: d.count,
        who: d.members,
      })),
      bestWindow: computed?.window ?? null,
      topDestinations: (computed?.dests ?? []).slice(0, 6).map((d) => ({
        name: d.name,
        score: d.score,
        votes: d.votes,
        avgRank: d.avgRank,
      })),
      weather: Object.fromEntries(
        Object.entries(weather).map(([name, r]) => [name, summarize(r.days)]),
      ),
    }
    const res = await getAiSuggestion(payload)
    setAi({ text: res.text || '', error: res.error || '', busy: false })
  }

  if (!computed) return <p className="muted">載入中…</p>

  const noData =
    computed.dates.length === 0 && computed.dests.every((d) => d.votes === 0)
  if (noData) {
    return (
      <p className="muted">
        還沒有足夠的資料。請大家先到「我的時段」勾選有空日期、到「目的地與志願序」排一下順序，這裡就會出現彙整結果。
      </p>
    )
  }

  return (
    <div className="summary">
      {/* 重疊時段 */}
      <section className="card">
        <h3>🗓️ 大家最有空的日期</h3>
        {computed.dates.length === 0 ? (
          <p className="muted small">還沒有人勾選時段。</p>
        ) : (
          <ul className="rank-bars">
            {computed.dates.slice(0, 8).map((d) => (
              <li key={d.date}>
                <span className="bar-label">{fmtDate(d.date)}</span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{ width: `${(d.count / Math.max(members.length, 1)) * 100}%` }}
                  />
                </span>
                <span className="bar-value" title={d.members.join('、')}>
                  {d.count}/{members.length} 人
                </span>
              </li>
            ))}
          </ul>
        )}
        {computed.window && (
          <p className="muted small">
            建議區間：<strong>{fmtDate(computed.window.start)}</strong>
            {computed.window.end !== computed.window.start && (
              <> ～ <strong>{fmtDate(computed.window.end)}</strong></>
            )}
            （{computed.window.count} 人皆有空）
          </p>
        )}
      </section>

      {/* 熱門目的地 */}
      <section className="card">
        <h3>🌍 最想去的地方（依志願序加權）</h3>
        {topDests.length === 0 ? (
          <p className="muted small">還沒有人排志願序。</p>
        ) : (
          <table className="rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th>地點</th>
                <th>加權分</th>
                <th>投票數</th>
                <th>平均志願</th>
                <th>機票</th>
              </tr>
            </thead>
            <tbody>
              {computed.dests
                .filter((d) => d.votes > 0)
                .map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td>{d.name}</td>
                    <td>{d.score}</td>
                    <td>{d.votes}</td>
                    <td>{d.avgRank ? d.avgRank.toFixed(1) : '—'}</td>
                    <td>
                      <a href={flightsLink(d.name)} target="_blank" rel="noreferrer" className="linklike">
                        查機票 ↗
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 天氣 */}
      <section className="card">
        <div className="card-head">
          <h3>🌤️ 熱門目的地天氣</h3>
          <button className="btn ghost small" onClick={loadWeather} disabled={weatherBusy || !computed.window || topDests.length === 0}>
            {weatherBusy ? '查詢中…' : '查詢天氣'}
          </button>
        </div>
        {!computed.window && <p className="muted small">先有重疊時段才能查對應天氣。</p>}
        {Object.keys(weather).length === 0 ? (
          <p className="muted small">按「查詢天氣」載入前三名目的地在建議區間的天氣。</p>
        ) : (
          <div className="weather-grid">
            {topDests.map((d) => {
              const w = weather[d.name]
              if (!w) return null
              if (w.error) return (
                <div key={d.name} className="weather-card">
                  <strong>{d.name}</strong>
                  <p className="muted small">{w.error}</p>
                </div>
              )
              const s = summarize(w.days)
              return (
                <div key={d.name} className="weather-card">
                  <strong>{d.name}</strong>
                  <p className="muted small">{w.place?.label}</p>
                  {s ? (
                    <>
                      <p className="weather-temp">
                        {s.avgMin}° ~ {s.avgMax}°C
                      </p>
                      <p className="muted small">
                        {s.total} 天中約 {s.rainDays} 天有雨
                      </p>
                      <p className="muted small">
                        {w.source === 'forecast' ? '（實際預報）' : '（去年同期參考）'}
                      </p>
                    </>
                  ) : (
                    <p className="muted small">無資料</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* AI 建議 */}
      <section className="card">
        <div className="card-head">
          <h3>🤖 AI 彙整建議</h3>
          <button className="btn primary small" onClick={askAi} disabled={ai.busy}>
            {ai.busy ? '思考中…' : '產生 AI 建議'}
          </button>
        </div>
        {!aiConfigured && (
          <p className="muted small">
            AI 尚未設定。設定方式見 README 的「AI 設定」章節；未設定時其他功能仍可正常使用。
          </p>
        )}
        {ai.error && <p className="error">{ai.error}</p>}
        {ai.text && <div className="ai-output">{ai.text}</div>}
        {!ai.text && !ai.error && aiConfigured && (
          <p className="muted small">
            按「產生 AI 建議」，讓 AI 根據上面的時段、志願序與天氣，幫你們推薦目的地與初步行程方向。
          </p>
        )}
      </section>
    </div>
  )
}
