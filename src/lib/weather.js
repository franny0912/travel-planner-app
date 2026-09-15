// 天氣：使用 Open-Meteo（免費、免金鑰）。
// 1) 用地名查經緯度 2) 依日期取天氣：16 天內用預報，較遠則抓「去年同期」當季節參考。

const GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'

// WMO weather code → 中文描述 + emoji
const WMO = {
  0: ['晴', '☀️'], 1: ['大致晴朗', '🌤️'], 2: ['局部多雲', '⛅'], 3: ['陰', '☁️'],
  45: ['有霧', '🌫️'], 48: ['霧凇', '🌫️'],
  51: ['毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['毛毛雨', '🌦️'],
  61: ['小雨', '🌧️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
  66: ['凍雨', '🌧️'], 67: ['凍雨', '🌧️'],
  71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'],
  80: ['陣雨', '🌦️'], 81: ['陣雨', '🌧️'], 82: ['強陣雨', '⛈️'],
  85: ['陣雪', '🌨️'], 86: ['強陣雪', '❄️'],
  95: ['雷雨', '⛈️'], 96: ['雷雨伴冰雹', '⛈️'], 99: ['強雷雨伴冰雹', '⛈️'],
}

export function describeCode(code) {
  return WMO[code] ?? ['—', '❔']
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`天氣服務錯誤 ${res.status}`)
  return res.json()
}

// 地名 → 經緯度。優先中文，找不到再用英文。
export async function geocode(name) {
  for (const lang of ['zh', 'en']) {
    const url = `${GEO}?name=${encodeURIComponent(name)}&count=1&language=${lang}&format=json`
    try {
      const data = await fetchJson(url)
      if (data.results?.length) {
        const r = data.results[0]
        return {
          lat: r.latitude,
          lon: r.longitude,
          label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
          country: r.country,
        }
      }
    } catch {
      /* 換下一個語言 */
    }
  }
  return null
}

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

// 取某地在 startDate~endDate 的天氣。
// 回傳 { source: 'forecast' | 'last-year', place, days: [{date, tmax, tmin, precip, code}] }
export async function getWeather(name, startDate, endDate) {
  const place = await geocode(name)
  if (!place) return { error: `找不到「${name}」的座標`, place: null, days: [] }

  const start = new Date(startDate)
  const end = new Date(endDate || startDate)
  const today = new Date(ymd(new Date())) // 只取日期
  const leadDays = daysBetween(today, start)

  const useForecast = leadDays >= 0 && daysBetween(today, end) <= 15
  const daily = 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode'

  try {
    if (useForecast) {
      const url =
        `${FORECAST}?latitude=${place.lat}&longitude=${place.lon}` +
        `&daily=${daily}&timezone=auto&start_date=${ymd(start)}&end_date=${ymd(end)}`
      const data = await fetchJson(url)
      return { source: 'forecast', place, days: shape(data.daily) }
    }
    // 較遠日期：抓去年同期當作季節參考
    const ly = (d) => {
      const x = new Date(d)
      x.setFullYear(x.getFullYear() - 1)
      return ymd(x)
    }
    const url =
      `${ARCHIVE}?latitude=${place.lat}&longitude=${place.lon}` +
      `&daily=${daily}&timezone=auto&start_date=${ly(start)}&end_date=${ly(end)}`
    const data = await fetchJson(url)
    return { source: 'last-year', place, days: shape(data.daily) }
  } catch (e) {
    return { error: e.message, place, days: [] }
  }
}

function shape(daily) {
  if (!daily?.time) return []
  return daily.time.map((date, i) => ({
    date,
    tmax: daily.temperature_2m_max?.[i],
    tmin: daily.temperature_2m_min?.[i],
    precip: daily.precipitation_sum?.[i],
    code: daily.weathercode?.[i],
  }))
}

// 把多天資料收斂成一句摘要
export function summarize(days) {
  const valid = days.filter((d) => d.tmax != null && d.tmin != null)
  if (!valid.length) return null
  const avgMax = valid.reduce((s, d) => s + d.tmax, 0) / valid.length
  const avgMin = valid.reduce((s, d) => s + d.tmin, 0) / valid.length
  const rainDays = valid.filter((d) => (d.precip ?? 0) >= 1).length
  return {
    avgMax: Math.round(avgMax),
    avgMin: Math.round(avgMin),
    rainDays,
    total: valid.length,
  }
}
