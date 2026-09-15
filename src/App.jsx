import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Trip from './pages/Trip.jsx'
import { backendName } from './lib/db.js'

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          ✈️ 一起去旅遊
        </Link>
        {backendName === 'local' && (
          <span className="badge badge-warn" title="尚未設定 Supabase，資料只存在這台裝置">
            單機模式
          </span>
        )}
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trip/:code" element={<Trip />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>和朋友一起挑時間、選國家、看天氣，讓 AI 幫忙出主意。</span>
      </footer>
    </div>
  )
}
