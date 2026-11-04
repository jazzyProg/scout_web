import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Contact, Link2, Loader2, LogOut, MessageSquare, Moon, Plus, Search, Settings, Sparkles, Sun, Trash2 } from 'lucide-react'
import { api, login, logout, setUnauthorizedHandler } from './api'
import { Confirm, ToastProvider, useToast } from './ui'
import SearchPage from './pages/SearchPage'
import LookupPage from './pages/LookupPage'
import ContactsPage from './pages/ContactsPage'
import StatusPage from './pages/StatusPage'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

const PAGES = [
  { id: 'search', label: 'Поиск', icon: Sparkles },
  { id: 'lookup', label: 'По ссылке', icon: Link2 },
  { id: 'contacts', label: 'Контакты', icon: Contact },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

const readHash = () => {
  const [page, arg] = window.location.hash.replace('#', '').split('/')
  return { page: PAGES.some((p) => p.id === page) ? page : 'search', arg }
}

function getTheme() {
  try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' }
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  )
}

function Root() {
  const [authed, setAuthed] = useState(null)
  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false))
    api.get('/api/me').then((r) => setAuthed(r.auth)).catch(() => setAuthed(false))
  }, [])
  if (authed === null) return <div className="login"><Loader2 className="spin" /></div>
  return authed ? <Shell onLogout={() => setAuthed(false)} /> : <Login onOk={() => setAuthed(true)} />
}

function Login({ onOk }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try { await login(pw); onOk() } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand-logo"><Search size={18} strokeWidth={2.6} /></div>
        <h1>Scout</h1>
        <p className="muted" style={{ margin: '0 0 20px' }}>ИИ-поиск людей и контактов</p>
        <input className="input" type="password" autoFocus placeholder="Пароль" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <div className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{err}</div>}
        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 14 }} disabled={busy || !pw}>
          {busy && <Loader2 size={16} className="spin" />} Войти
        </button>
      </form>
    </div>
  )
}

function Shell({ onLogout }) {
  const toast = useToast()
  const [route, setRoute] = useState(readHash)
  const [credits, setCredits] = useState(null)
  const [stats, setStats] = useState(null)
  const [chats, setChats] = useState([])
  const [settings, setSettings] = useState(null)
  const [chatNonce, setChatNonce] = useState(0)
  const [confirmState, setConfirm] = useState(null)
  const [theme, setTheme] = useState(getTheme)

  const refreshChats = useCallback(async () => {
    try { setChats((await api.get('/api/chats')).items) } catch { /* next time */ }
  }, [])
  useEffect(() => {
    refreshChats()
    api.get('/api/settings').then(setSettings).catch(() => {})
  }, [refreshChats])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* private mode */ }
  }, [theme])

  useEffect(() => {
    const h = () => setRoute(readHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  const refreshCredits = useCallback(async (fresh = false) => {
    try { setCredits(await api.get(`/api/credits${fresh ? '?fresh=1' : ''}`)) } catch { /* shown on the status page */ }
    try { setStats(await api.get('/api/stats')) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    refreshCredits()
    const t = setInterval(() => refreshCredits(), 60000)
    return () => clearInterval(t)
  }, [refreshCredits])

  const go = (page, arg) => { window.location.hash = arg ? `${page}/${arg}` : page }
  const newChat = () => { setChatNonce((n) => n + 1); go('search') }
  const deleteChat = (c) => setConfirm({
    title: 'Удалить чат?',
    body: `«${c.title}». Найденные в нём люди останутся во вкладке «Контакты» и повторно в поиск не попадут.`,
    ok: 'Удалить',
    onOk: async () => {
      await api.del(`/api/chats/${c.id}`)
      refreshChats()
      if (route.page === 'search' && String(route.arg) === String(c.id)) newChat()
    },
  })
  const ctx = { toast, confirm: setConfirm, credits, stats, refreshCredits, go, chats, refreshChats, settings, setSettings }
  const pct = credits?.limit ? Math.max(0, Math.min(100, (credits.left / credits.limit) * 100)) : 0

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo"><Search size={17} strokeWidth={2.6} /></div>
            <div>
              <div className="brand-name">Scout</div>
              <div className="brand-sub">Apollo + ИИ</div>
            </div>
          </div>
          <button className="btn btn-primary new-chat" onClick={newChat}><Plus size={16} /> Новый чат</button>
          {PAGES.map((p) => (
            <button key={p.id} className={`nav-item ${route.page === p.id ? 'active' : ''}`} onClick={() => go(p.id)}>
              <p.icon size={17} /> {p.label}
              {p.id === 'contacts' && stats?.enriched > 0 && <span className="nav-badge num">{stats.enriched}</span>}
            </button>
          ))}
          <div className="chats-head">Чаты</div>
          <div className="chat-list">
            {chats.length === 0 && <div className="small faint" style={{ padding: '4px 11px' }}>Пока пусто</div>}
            {chats.map((c) => (
              <div key={c.id} className={`chat-item ${route.page === 'search' && String(route.arg) === String(c.id) ? 'active' : ''}`}
                onClick={() => go('search', c.id)} title={c.title}>
                <MessageSquare size={14} />
                <span className="chat-title">{c.title}</span>
                <span className="chat-n num">{c.found}</span>
                <button className="chat-del" title="Удалить чат" onClick={(e) => { e.stopPropagation(); deleteChat(c) }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="sidebar-foot">
            <div className="credits-card" title="Lead-кредиты Apollo в текущем периоде">
              <div className="small muted">Кредиты Apollo</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <span className="big num">{credits?.left != null ? credits.left.toLocaleString('ru-RU') : '—'}</span>
                {credits?.limit != null && <span className="small faint num">/ {credits.limit.toLocaleString('ru-RU')}</span>}
              </div>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
              {credits?.cycle_end && <div className="small faint" style={{ marginTop: 6 }}>обновятся {new Date(credits.cycle_end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>}
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-sm grow" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Светлая' : 'Тёмная'}
              </button>
              <button className="btn btn-ghost btn-sm" title="Выйти" onClick={async () => { await logout(); onLogout() }}>
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </aside>
        <main className={`main ${route.page === 'search' ? 'chat-mode' : ''}`}>
          <div style={{ display: route.page === 'search' ? 'block' : 'none' }}>
            <SearchPage chatId={route.page === 'search' ? route.arg : undefined} nonce={chatNonce} />
          </div>
          {route.page === 'lookup' && <LookupPage />}
          {route.page === 'contacts' && <ContactsPage />}
          {route.page === 'settings' && <StatusPage theme={theme} setTheme={setTheme} onLogout={onLogout} />}
        </main>
        <nav className="mobile-nav">
          {PAGES.map((p) => (
            <button key={p.id} className={route.page === p.id ? 'active' : ''} onClick={() => go(p.id)}>
              <p.icon size={20} /> {p.label}
            </button>
          ))}
        </nav>
      </div>
      <Confirm state={confirmState} onClose={() => setConfirm(null)} />
    </AppCtx.Provider>
  )
}
