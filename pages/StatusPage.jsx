import { useCallback, useEffect, useState } from 'react'
import { Bot, Coins, Globe, Linkedin, LogOut, Moon, RefreshCw, Save, Sun, Target } from 'lucide-react'
import { api, logout } from '../api'
import { useApp } from '../App'

export default function StatusPage({ theme, setTheme, onLogout }) {
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setS(await api.get('/api/status')) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Настройки</h1>
          <p>Как агент ищет и что считает важным; состояние Apollo, прокси, LinkedIn и модели.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Проверить</button>
      </div>
      <AgentSettings />
      <div className="status-grid" style={{ marginTop: 14 }}>
        <Card icon={Coins} title="Apollo" ok={s?.apollo?.ok}>
          {s?.apollo?.ok ? (
            <dl className="kv">
              <dt>Осталось кредитов</dt><dd className="num"><b>{s.apollo.left?.toLocaleString('ru-RU')}</b> из {s.apollo.limit?.toLocaleString('ru-RU')}</dd>
              <dt>Потрачено</dt><dd className="num">{s.apollo.used?.toLocaleString('ru-RU')}</dd>
              <dt>Период до</dt><dd>{s.apollo.cycle_end ? new Date(s.apollo.cycle_end).toLocaleDateString('ru-RU') : '—'}</dd>
              <dt>Цены</dt><dd>поиск людей — бесплатно; компания — 1 (один раз); контакт — 1 + 8 за мобильный</dd>
            </dl>
          ) : <Err s={s?.apollo} />}
        </Card>
        <Card icon={Globe} title="Прокси (США)" ok={s?.proxy?.ok}>
          {s?.proxy?.ok ? (
            <dl className="kv">
              <dt>Внешний IP</dt><dd className="num">{s.proxy.ip}</dd>
              <dt>Где</dt><dd>{[s.proxy.city, s.proxy.country].filter(Boolean).join(', ')}</dd>
              <dt>Провайдер</dt><dd>{s.proxy.org}</dd>
            </dl>
          ) : <Err s={s?.proxy} />}
        </Card>
        <Card icon={Linkedin} title="LinkedIn" ok={s?.linkedin?.ok && s?.linkedin?.logged_in} warn={s?.linkedin?.restricted || s?.linkedin?.usage?.paused_until}>
          {s?.linkedin?.ok ? (
            <dl className="kv">
              <dt>Сессия</dt><dd>{s.linkedin.logged_in ? 'вход выполнен' : 'нужен вход'}</dd>
              {s.linkedin.restricted && <><dt>Аккаунт</dt><dd style={{ color: 'var(--amber)' }}>LinkedIn ограничил аккаунт</dd></>}
              {s.linkedin.usage && (
                <>
                  <dt>Запросов</dt>
                  <dd className="num">за час {s.linkedin.usage.hour} из {s.linkedin.usage.per_hour} · за сутки {s.linkedin.usage.day} из {s.linkedin.usage.per_day}</dd>
                  {s.linkedin.usage.paused_until && (
                    <><dt>Пауза</dt><dd style={{ color: 'var(--amber)' }}>до {new Date(s.linkedin.usage.paused_until * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — {s.linkedin.usage.pause_reason}</dd></>
                  )}
                </>
              )}
              <dt>Ждут поиска профиля</dt><dd className="num">{s.linkedin.waiting ?? 0} чел.</dd>
              <dt>Для чего</dt><dd>бесплатно находит профиль каждого найденного человека; запасной поиск, если Apollo нашёл мало</dd>
              {!s.linkedin.logged_in && <><dt>Как войти</dt><dd>на сервере: <code>~/research_agent_people/linkedin-login.sh</code></dd></>}
            </dl>
          ) : <Err s={s?.linkedin} />}
        </Card>
        <Card icon={Bot} title="ИИ-модель" ok={s?.ollama?.ok} warn={s?.ollama?.ok && !s?.ollama?.loaded}>
          {s?.ollama?.ok ? (
            <dl className="kv">
              <dt>Модель</dt><dd>{s.ollama.model}</dd>
              <dt>В памяти</dt><dd>{s.ollama.loaded ? 'загружена' : 'загрузится при первом запросе (~10–20 с)'}</dd>
              <dt>Thinking</dt><dd>выключен</dd>
            </dl>
          ) : <Err s={s?.ollama} />}
        </Card>
      </div>
      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="row wrap">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Оформление и сеанс</div>
            <div className="small muted">По умолчанию: регион {s?.defaults?.location || 'United States'}, {s?.defaults?.count || 5} человек на поиск.</div>
          </div>
          <button className="btn btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          </button>
          <button className="btn btn-sm btn-danger" onClick={async () => { await logout(); onLogout() }}><LogOut size={14} /> Выйти</button>
        </div>
      </div>
    </div>
  )
}

function Card({ icon: I, title, ok, warn, children }) {
  return (
    <div className="card card-pad">
      <div className="row">
        <I size={17} color="var(--accent)" />
        <span style={{ fontWeight: 650 }}>{title}</span>
        <div className="grow" />
        {ok === undefined ? <span className="skeleton" style={{ width: 60, height: 16 }} />
          : <span className="row small muted" style={{ gap: 6 }}><span className={`dot ${!ok ? 'bad' : warn ? 'warn' : 'ok'}`} />{!ok ? 'ошибка' : 'работает'}</span>}
      </div>
      {children}
    </div>
  )
}

const Err = ({ s }) => (s ? <div className="small" style={{ color: 'var(--red)', marginTop: 12 }}>{s.error}</div> : <div className="skeleton" style={{ height: 60, marginTop: 12 }} />)

function AgentSettings() {
  const { settings, setSettings, toast } = useApp()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (settings && !form) setForm(settings) }, [settings, form])
  if (!form) return <div className="skeleton" style={{ height: 180 }} />
  const dirty = JSON.stringify(form) !== JSON.stringify(settings)
  const save = async () => {
    setSaving(true)
    try {
      const s = await api.put('/api/settings', form)
      setSettings(s)
      setForm(s)
      toast('Настройки сохранены', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="card card-pad">
      <div className="row"><Target size={17} color="var(--accent)" /><span style={{ fontWeight: 650 }}>Приоритеты агента</span></div>
      <div className="small muted" style={{ margin: '6px 0 10px' }}>
        Учитываются при подборе похожих компаний и оценке релевантности людей. Пишите обычным текстом.
      </div>
      <textarea className="input" rows={4} value={form.priorities} onChange={(e) => setForm({ ...form, priorities: e.target.value })} />
      <div className="row wrap" style={{ marginTop: 12, gap: 18 }}>
        <label className="row small muted" style={{ gap: 8 }}>
          Людей за поиск по умолчанию
          <input className="input num" style={{ width: 80 }} type="number" min={1} max={200} value={form.default_count}
            onChange={(e) => setForm({ ...form, default_count: Number(e.target.value) || 1 })} />
        </label>
        <label className="row small muted" style={{ gap: 8 }}>
          Максимум людей из одной компании (0 — без лимита)
          <input className="input num" style={{ width: 70 }} type="number" min={0} max={50} value={form.per_company}
            onChange={(e) => setForm({ ...form, per_company: Number(e.target.value) || 0 })} />
        </label>
        <label className="row small muted" style={{ gap: 8 }} title="Сколько страниц LinkedIn аккаунт открывает в час и в сутки. Больше — быстрее находятся профили, но выше риск ограничений аккаунта.">
          LinkedIn: запросов в час
          <input className="input num" style={{ width: 70 }} type="number" min={0} max={120} value={form.li_per_hour}
            onChange={(e) => setForm({ ...form, li_per_hour: Math.min(120, Number(e.target.value) || 0) })} />
          в сутки
          <input className="input num" style={{ width: 80 }} type="number" min={0} max={1000} value={form.li_per_day}
            onChange={(e) => setForm({ ...form, li_per_day: Math.min(1000, Number(e.target.value) || 0) })} />
        </label>
        <div className="grow" />
        <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save}><Save size={14} /> Сохранить</button>
      </div>
    </div>
  )
}
