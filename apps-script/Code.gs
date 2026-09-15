/**
 * 一起去旅遊 · 揪團規劃（Google Apps Script 版）
 * 後端：以一個 Google 試算表當資料庫；前端由 HtmlService 提供。
 * 天氣（Open-Meteo）與 AI（Claude）都在伺服器端用 UrlFetchApp 呼叫，避免瀏覽器 CORS 問題。
 */

// ====== 網頁入口 ======
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('一起去旅遊 · 揪團規劃')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

// 讓 Index.html 能 include 其他 html 檔（樣式、前端 JS）
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent()
}

// ====== 試算表資料庫 ======
var SHEETS = {
  trips: ['id', 'code', 'name', 'created_at'],
  members: ['id', 'trip_id', 'nickname', 'created_at'],
  availability: ['id', 'trip_id', 'member_id', 'date'],
  destinations: ['id', 'trip_id', 'name', 'created_by', 'created_at'],
  preferences: ['id', 'trip_id', 'member_id', 'destination_id', 'rank'],
}

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties()
  var id = props.getProperty('SHEET_ID')
  if (id) {
    try {
      return SpreadsheetApp.openById(id)
    } catch (e) {
      // 若原檔被刪除，往下重建
    }
  }
  var ss = SpreadsheetApp.create('旅遊揪團資料')
  props.setProperty('SHEET_ID', ss.getId())
  return ss
}

function getSheet_(name) {
  var ss = getSpreadsheet_()
  var sheet = ss.getSheetByName(name)
  var headers = SHEETS[name]
  if (!sheet) {
    sheet = ss.insertSheet(name)
    // 移除預設空白工作表 "Sheet1"（若存在且非本表）
    var def = ss.getSheetByName('Sheet1')
    if (def && def.getName() !== name && ss.getSheets().length > 1) {
      try { ss.deleteSheet(def) } catch (e) {}
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    // 全部欄位設為純文字，避免日期/邀請碼被自動轉型
    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat('@')
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]) // 重設標題（格式套用後）
  }
  return sheet
}

function readRows_(name) {
  var sheet = getSheet_(name)
  var headers = SHEETS[name]
  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return []
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
  return values.map(function (row) {
    var obj = {}
    headers.forEach(function (h, i) {
      obj[h] = row[i] === '' ? null : String(row[i])
    })
    return obj
  })
}

function appendRow_(name, obj) {
  var sheet = getSheet_(name)
  var headers = SHEETS[name]
  var row = headers.map(function (h) {
    return obj[h] == null ? '' : String(obj[h])
  })
  sheet.appendRow(row)
}

// 刪除符合 predicate 的列（由下往上刪）
function deleteWhere_(name, predicate) {
  var sheet = getSheet_(name)
  var headers = SHEETS[name]
  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
  for (var i = values.length - 1; i >= 0; i--) {
    var obj = {}
    headers.forEach(function (h, j) {
      obj[h] = values[i][j] === '' ? null : String(values[i][j])
    })
    if (predicate(obj)) sheet.deleteRow(i + 2)
  }
}

function uuid_() {
  return Utilities.getUuid()
}

function makeInviteCode_() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  var code = ''
  for (var i = 0; i < 6; i++) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return code
}

function withLock_(fn) {
  var lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// ====== 前端可呼叫的 API（google.script.run） ======

function apiGetConfig() {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY')
  var url = ''
  try { url = ScriptApp.getService().getUrl() || '' } catch (e) {}
  return { aiConfigured: !!key, webAppUrl: url }
}

function apiCreateTrip(name) {
  return withLock_(function () {
    var code
    var trips = readRows_('trips')
    // 產生不重複邀請碼
    do {
      code = makeInviteCode_()
    } while (trips.some(function (t) { return t.code === code }))
    var trip = { id: uuid_(), code: code, name: name, created_at: new Date().toISOString() }
    appendRow_('trips', trip)
    return trip
  })
}

function apiGetTripByCode(code) {
  code = String(code || '').toUpperCase()
  var trips = readRows_('trips')
  var trip = trips.filter(function (t) { return t.code === code })[0]
  return trip || null
}

function apiGetTrip(tripId) {
  var trips = readRows_('trips')
  return trips.filter(function (t) { return t.id === tripId })[0] || null
}

function apiJoinTrip(tripId, nickname) {
  return withLock_(function () {
    var members = readRows_('members')
    var existing = members.filter(function (m) {
      return m.trip_id === tripId && m.nickname === nickname
    })[0]
    if (existing) return existing
    var member = { id: uuid_(), trip_id: tripId, nickname: nickname, created_at: new Date().toISOString() }
    appendRow_('members', member)
    return member
  })
}

function apiListMembers(tripId) {
  return readRows_('members').filter(function (m) { return m.trip_id === tripId })
}

function apiListAvailability(tripId) {
  return readRows_('availability').filter(function (a) { return a.trip_id === tripId })
}

function apiSetAvailability(tripId, memberId, dates) {
  return withLock_(function () {
    deleteWhere_('availability', function (a) {
      return a.trip_id === tripId && a.member_id === memberId
    })
    ;(dates || []).forEach(function (date) {
      appendRow_('availability', { id: uuid_(), trip_id: tripId, member_id: memberId, date: date })
    })
    return true
  })
}

function apiListDestinations(tripId) {
  return readRows_('destinations').filter(function (d) { return d.trip_id === tripId })
}

function apiAddDestination(tripId, name, createdBy) {
  return withLock_(function () {
    var dest = {
      id: uuid_(), trip_id: tripId, name: name, created_by: createdBy,
      created_at: new Date().toISOString(),
    }
    appendRow_('destinations', dest)
    return dest
  })
}

function apiRemoveDestination(destId) {
  return withLock_(function () {
    deleteWhere_('preferences', function (p) { return p.destination_id === destId })
    deleteWhere_('destinations', function (d) { return d.id === destId })
    return true
  })
}

function apiListPreferences(tripId) {
  return readRows_('preferences').filter(function (p) { return p.trip_id === tripId })
}

function apiSetPreferences(tripId, memberId, orderedDestIds) {
  return withLock_(function () {
    deleteWhere_('preferences', function (p) {
      return p.trip_id === tripId && p.member_id === memberId
    })
    ;(orderedDestIds || []).forEach(function (destId, idx) {
      appendRow_('preferences', {
        id: uuid_(), trip_id: tripId, member_id: memberId,
        destination_id: destId, rank: idx + 1,
      })
    })
    return true
  })
}

// ====== 天氣（Open-Meteo，伺服器端） ======

function apiGetWeather(name, startDate, endDate) {
  var place = geocode_(name)
  if (!place) return { error: '找不到「' + name + '」的座標', place: null, days: [] }

  var start = startDate
  var end = endDate || startDate
  var today = new Date()
  var todayStr = Utilities.formatDate(today, 'UTC', 'yyyy-MM-dd')
  var leadDays = dateDiff_(todayStr, start)
  var endLead = dateDiff_(todayStr, end)

  var daily = 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode'
  try {
    if (leadDays >= 0 && endLead <= 15) {
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat +
        '&longitude=' + place.lon + '&daily=' + daily +
        '&timezone=auto&start_date=' + start + '&end_date=' + end
      var data = fetchJson_(url)
      return { source: 'forecast', place: place, days: shapeDaily_(data.daily) }
    }
    var lyStart = shiftYear_(start, -1)
    var lyEnd = shiftYear_(end, -1)
    var aurl = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + place.lat +
      '&longitude=' + place.lon + '&daily=' + daily +
      '&timezone=auto&start_date=' + lyStart + '&end_date=' + lyEnd
    var adata = fetchJson_(aurl)
    return { source: 'last-year', place: place, days: shapeDaily_(adata.daily) }
  } catch (e) {
    return { error: String(e), place: place, days: [] }
  }
}

function geocode_(name) {
  var langs = ['zh', 'en']
  for (var i = 0; i < langs.length; i++) {
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(name) + '&count=1&language=' + langs[i] + '&format=json'
    try {
      var data = fetchJson_(url)
      if (data.results && data.results.length) {
        var r = data.results[0]
        return {
          lat: r.latitude, lon: r.longitude,
          label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
          country: r.country,
        }
      }
    } catch (e) {}
  }
  return null
}

function shapeDaily_(daily) {
  if (!daily || !daily.time) return []
  return daily.time.map(function (date, i) {
    return {
      date: date,
      tmax: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
      tmin: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
      precip: daily.precipitation_sum ? daily.precipitation_sum[i] : null,
      code: daily.weathercode ? daily.weathercode[i] : null,
    }
  })
}

function fetchJson_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  if (res.getResponseCode() >= 400) throw new Error('服務錯誤 ' + res.getResponseCode())
  return JSON.parse(res.getContentText())
}

function dateDiff_(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function shiftYear_(dateStr, delta) {
  var d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + delta)
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd')
}

// ====== AI 建議（Claude，伺服器端） ======

function apiGetAiSuggestion(payload) {
  var props = PropertiesService.getScriptProperties()
  var apiKey = props.getProperty('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return { error: 'AI 尚未設定：請在 Apps Script 的「專案設定 → 指令碼屬性」新增 ANTHROPIC_API_KEY。' }
  }
  var model = props.getProperty('ANTHROPIC_MODEL') || 'claude-opus-5'
  var prompt = buildAiPrompt_(payload)

  try {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      payload: JSON.stringify({
        model: model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    var code = res.getResponseCode()
    var body = JSON.parse(res.getContentText() || '{}')
    if (code >= 400) {
      return { error: 'Claude 錯誤 ' + code + '：' + ((body.error && body.error.message) || res.getContentText()) }
    }
    var text = (body.content || [])
      .filter(function (b) { return b.type === 'text' })
      .map(function (b) { return b.text })
      .join('\n')
    return { text: text }
  } catch (e) {
    return { error: 'Claude 呼叫失敗：' + String(e) }
  }
}

function buildAiPrompt_(p) {
  p = p || {}
  var dates = (p.topDates || []).map(function (d) {
    return '  - ' + d.date + '：' + d.count + ' 人有空（' + (d.who || []).join('、') + '）'
  }).join('\n')
  var dests = (p.topDestinations || []).map(function (d) {
    return '  - ' + d.name + '：加權分 ' + d.score + '、' + d.votes + ' 人投票' +
      (d.avgRank ? '、平均志願 ' + Number(d.avgRank).toFixed(1) : '')
  }).join('\n')
  var weather = Object.keys(p.weather || {}).filter(function (k) { return p.weather[k] }).map(function (k) {
    var w = p.weather[k]
    return '  - ' + k + '：約 ' + w.avgMin + '~' + w.avgMax + '°C，' + w.total + ' 天中約 ' + w.rainDays + ' 天有雨'
  }).join('\n')
  var win = p.bestWindow
    ? p.bestWindow.start + (p.bestWindow.end && p.bestWindow.end !== p.bestWindow.start ? ' ~ ' + p.bestWindow.end : '') + '（' + p.bestWindow.count + ' 人皆有空）'
    : '尚未有明確重疊時段'

  return '你是一位貼心的旅遊規劃顧問。以下是一群朋友（共 ' + (p.memberCount || '?') + ' 人：' +
    (p.members || []).join('、') + '）為了「' + (p.tripName || '這趟旅行') + '」所填的資料。請用繁體中文，幫他們做出實用的分析與建議。\n\n' +
    '【大家最有空的日期】\n' + (dates || '  （尚無資料）') + '\n建議出遊區間：' + win + '\n\n' +
    '【最想去的地方（依志願序加權）】\n' + (dests || '  （尚無資料）') + '\n\n' +
    '【熱門目的地天氣（若有）】\n' + (weather || '  （尚無資料）') + '\n\n' +
    '請提供：\n' +
    '1. 綜合時間、票數與天氣，推薦 1~2 個最適合的目的地，並說明理由（特別點出天氣是否適合出遊）。\n' +
    '2. 針對推薦目的地，給出建議的出遊天數與 3~5 天的行程大方向（每天一句重點即可）。\n' +
    '3. 一段給這群朋友的貼心提醒或討論建議（例如還需要確認什麼、如何取捨分歧）。\n\n' +
    '請用清楚的段落與條列，語氣輕鬆友善。不要杜撰資料中沒有的機票價格或確切航班。'
}
