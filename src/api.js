// Where the API lives. Empty: the same site (the UI served by the backend itself).
// The build for GitHub Pages sets VITE_API_URL to the public backend address.
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const TOKEN_KEY = 'scout_token'
let memToken = null
const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || memToken } catch { return memToken }
}
export const setToken = (t) => {
  memToken = t
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

const authHeaders = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, url, body) {
  const res = await fetch(API_BASE + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
    credentials: API_BASE ? 'omit' : 'same-origin',
  })
  if (res.status === 401 && url !== '/api/login') {
    setToken(null)
    onUnauthorized()
    throw new Error('Нужен вход')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Ошибка ${res.status}`)
  return data
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body || {}),
  put: (url, body) => request('PUT', url, body || {}),
  patch: (url, body) => request('PATCH', url, body || {}),
  del: (url) => request('DELETE', url),
}

export async function login(password) {
  const r = await api.post('/api/login', { password })
  setToken(r.token)
  return r
}

export async function logout() {
  await api.post('/api/logout').catch(() => {})
  setToken(null)
}

/** Downloads an export: a plain link would not carry the Authorization header. */
export async function download(url) {
  const res = await fetch(API_BASE + url, { headers: authHeaders(), credentials: API_BASE ? 'omit' : 'same-origin' })
  if (!res.ok) throw new Error(`Ошибка выгрузки ${res.status}`)
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'contacts'
  const href = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}

/** POST that streams NDJSON events from the search agent. */
export async function streamSearch(body, onEvent, signal) {
  const res = await fetch(API_BASE + '/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
    signal,
    credentials: API_BASE ? 'omit' : 'same-origin',
  })
  if (res.status === 401) { setToken(null); onUnauthorized(); throw new Error('Нужен вход') }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    const detail = Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join('; ') : d.detail
    throw new Error(detail || `Ошибка ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (line) onEvent(JSON.parse(line))
    }
  }
}

export const personName = (p) =>
  p.name || [p.first_name, p.last_name_hint].filter(Boolean).join(' ') || 'Без имени'

export const initials = (p) => {
  const parts = personName(p).replace(/\*/g, '').split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

export const fmtDate = (ts) =>
  ts ? new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export const fmtPhone = (n) => {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(n || '')
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : n
}

export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export const COST_PER_PERSON = 9 // contacts with a phone: 1 + 8 for a mobile
export const COST_BASE = 1 // LinkedIn + emails only
