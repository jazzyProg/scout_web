import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp, Bot, Building2, Check, CheckSquare, ChevronDown, Download, Loader2, RefreshCw, SlidersHorizontal,
  Sparkles, Square, Users, X, Zap,
} from 'lucide-react'
import { api, COST_PER_PERSON, download, plural, streamSearch } from '../api'
import { useApp } from '../App'
import { mergeList, PersonCard, PersonDrawer, useEnrich, useLivePeople } from '../people'
import { Stepper, Switch, TagInput } from '../ui'

const EXAMPLES = [
  ['CTO финтех-компаний в Нью-Йорке', 'Открытый поиск по отрасли и региону'],
  ['Head of Marketing в Notion и Figma', 'Конкретные компании'],
  ['Компании по типу Stake и Gamdom: кто ведёт соцсети и рекламу', 'Похожие компании + роли'],
  ['VP Sales в SaaS на 51–200 сотрудников, Калифорния', 'Фильтр по размеру компании'],
]

const SENIORITIES = [
  ['c_suite', 'C-level'], ['founder', 'Основатели'], ['owner', 'Владельцы'], ['vp', 'VP'], ['head', 'Head of'],
  ['director', 'Директора'], ['manager', 'Менеджеры'], ['senior', 'Senior'],
]
const SIZES = [
  ['1,10', '1–10'], ['11,50', '11–50'], ['51,200', '51–200'], ['201,500', '201–500'], ['501,1000', '501–1000'],
  ['1001,5000', '1001–5000'], ['5001,10000', '5001–10 000'], ['10001,1000000', '10 000+'],
]
const DEFAULT_LOCATION = 'United States'

const emptyForm = () => ({
  query: '', companies: [], titles: [], locations: [DEFAULT_LOCATION], seniorities: [], industries: [], employee_ranges: [],
})

const filterCount = (f) => f.companies.length + f.titles.length + f.seniorities.length + f.industries.length + f.employee_ranges.length

let turnSeq = 0

const turnFromSearch = ({ search: s, people }) => ({
  id: `s${s.id}`,
  request: s.params || {},
  label: s.query || '',
  people,
  selected: new Set(),
  running: false,
  run: {
    steps: [], plan: s.plan, companies: [], similar: [],
    done: s.status === 'done' ? { found: s.found, skipped: s.skipped, took: s.took } : null,
    error: s.status === 'done' ? null : (s.error || (s.status === 'running' ? 'Прервано' : null)),
    ...(s.run || {}),
  },
})

export default function SearchPage({ chatId, nonce }) {
  const { toast, refreshCredits, refreshChats, settings } = useApp()
  const [form, setForm] = useState(emptyForm)
  const [locTouched, setLocTouched] = useState(false)
  const [count, setCount] = useState(25)
  const [countSet, setCountSet] = useState(false)
  const [opts, setOpts] = useState({ expand: true, rank: true, linkedin: true, similar: false })
  const [loadingChat, setLoadingChat] = useState(false)
  const chatRef = useRef(null) // the chat these turns belong to (null = a new chat not saved yet)
  const [showFilters, setShowFilters] = useState(false)
  const [turns, setTurns] = useState([])
  const [running, setRunning] = useState(false)
  const [openId, setOpenId] = useState(null)
  const abortRef = useRef(null)
  const taRef = useRef(null)
  const endRef = useRef(null)

  const setTurn = useCallback((id, fn) => setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t))), [])
  const mergeAll = useCallback((rows) => setTurns((ts) => ts.map((t) => ({ ...t, people: mergeList(t.people, rows) }))), [])
  const { enrich, busy } = useEnrich(mergeAll)
  const allPeople = useMemo(() => turns.flatMap((t) => t.people), [turns])
  useLivePeople(allPeople, mergeAll)

  useEffect(() => {
    if (settings?.default_count && !countSet) setCount(settings.default_count)
  }, [settings, countSet])

  // open a chat from the sidebar, or start a new one
  useEffect(() => {
    const id = chatId ? Number(chatId) : null
    if (id && id === chatRef.current) return // the chat this page is already showing (or just created)
    abortRef.current?.abort()
    chatRef.current = id
    setTurns([])
    if (!id) return
    setLoadingChat(true)
    api.get(`/api/chats/${id}`)
      .then((d) => { if (chatRef.current === id) setTurns(d.turns.map(turnFromSearch)) })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoadingChat(false))
  }, [chatId, nonce, toast])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleIn = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }))
  const hasInput = form.query.trim() || form.companies.length || form.titles.length || form.industries.length || form.seniorities.length

  // keep the newest message in view while the agent streams, unless the user scrolled up to read
  const stick = useRef(true)
  useEffect(() => {
    const h = () => { stick.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 220 }
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  useLayoutEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns])

  // textarea grows with its text
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [form.query])

  const start = useCallback(async (request, label) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const id = ++turnSeq
    stick.current = true
    setTurns((ts) => [...ts, {
      id, request, label, people: [], selected: new Set(), running: true,
      run: { steps: [], plan: null, companies: [], similar: [], done: null, error: null },
    }])
    setRunning(true)
    const upd = (fn) => setTurn(id, (t) => ({ ...t, run: fn(t.run) }))
    try {
      await streamSearch({ ...request, chat_id: chatRef.current }, (ev) => {
        if (ev.type === 'started') {
          if (chatRef.current !== ev.chat_id) {
            chatRef.current = ev.chat_id
            window.history.replaceState(null, '', `#search/${ev.chat_id}`)
          }
          refreshChats()
        } else if (ev.type === 'step') {
          upd((r) => {
            const i = r.steps.findIndex((s) => s.id === ev.id)
            const steps = [...r.steps]
            if (i >= 0) steps[i] = ev; else steps.push(ev)
            return { ...r, steps }
          })
        } else if (ev.type === 'plan') upd((r) => ({ ...r, plan: ev.plan }))
        else if (ev.type === 'companies') upd((r) => ({ ...r, companies: ev.items, similar: ev.similar || [] }))
        else if (ev.type === 'results') setTurn(id, (t) => ({ ...t, people: ev.people }))
        else if (ev.type === 'done') upd((r) => ({ ...r, done: ev }))
        else if (ev.type === 'error') upd((r) => ({ ...r, error: ev.message }))
      }, ctrl.signal)
    } catch (e) {
      if (e.name === 'AbortError') upd((r) => ({ ...r, error: 'Остановлено' }))
      else { upd((r) => ({ ...r, error: e.message })); toast(e.message, 'error') }
    } finally {
      // nothing is "in progress" any more once the stream has ended, however it ended
      upd((r) => ({ ...r, steps: r.steps.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)) }))
      setTurn(id, (t) => ({ ...t, running: false }))
      setRunning(false)
      refreshCredits()
      refreshChats()
    }
  }, [setTurn, toast, refreshCredits, refreshChats])

  const submit = () => {
    if (!hasInput || running) return
    const request = {
      ...form, count, count_set: countSet, company_ids: {}, ...opts,
      per_company: settings?.per_company ?? 3,
    }
    start(request, form.query.trim())
    setForm((f) => ({ ...f, query: '' }))
    setShowFilters(false)
  }

  const more = (t) => start({ ...t.request, count: t.run.done?.found || t.request.count }, `Ещё по запросу: ${t.label || 'фильтры'}`)
  const pickCompany = (t, query, cid) => start(
    { ...t.request, company_ids: { ...t.request.company_ids, [query]: cid } },
    `${t.label || 'Поиск'} — компания «${query}» заменена`,
  )

  return (
    <div className="chat">
      <div className="thread">
        {loadingChat ? (
          <div className="hero"><Loader2 className="spin" /></div>
        ) : turns.length === 0 ? (
          <Hero onPick={(q) => { set('query')(q); taRef.current?.focus() }} />
        ) : turns.map((t) => (
          <Turn key={t.id} t={t} setTurn={setTurn} enrich={enrich} busy={busy}
            onOpen={setOpenId} onMore={() => more(t)} onPickCompany={(q, cid) => pickCompany(t, q, cid)}
            onStop={() => abortRef.current?.abort()} disabled={running} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="dock">
        {showFilters && (
          <div className="card filters-pop">
            <div className="filters-grid">
              <div>
                <div className="label"><Building2 size={13} /> Компании</div>
                <TagInput value={form.companies} onChange={set('companies')} placeholder="Notion, stripe.com…" />
              </div>
              <div>
                <div className="label"><Users size={13} /> Должности</div>
                <TagInput value={form.titles} onChange={set('titles')} placeholder="CTO, Head of Marketing…" />
              </div>
              <div>
                <div className="label">📍 Регион</div>
                <TagInput value={form.locations} onChange={(v) => { set('locations')(v); setLocTouched(true) }} placeholder="United States"
                  suggestions={['United States', 'New York, US', 'California, US', 'Florida, US', 'Texas, US']} />
                <div className="small faint" style={{ marginTop: 6 }}>Люди только из этого региона (пусто = США)</div>
              </div>
              <div>
                <div className="label">Отрасль компании</div>
                <TagInput value={form.industries} onChange={set('industries')} placeholder="fintech, saas, online casino…" />
              </div>
              <div className="span">
                <div className="label">Уровень</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {SENIORITIES.map(([v, l]) => (
                    <button key={v} className={`chip ${form.seniorities.includes(v) ? 'on' : ''}`} onClick={() => toggleIn('seniorities', v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="span">
                <div className="label">Размер компании</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {SIZES.map(([v, l]) => (
                    <button key={v} className={`chip ${form.employee_ranges.includes(v) ? 'on' : ''}`} onClick={() => toggleIn('employee_ranges', v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="span row wrap" style={{ gap: 18 }}>
                <Switch checked={opts.expand} onChange={(v) => setOpts((o) => ({ ...o, expand: v }))}>ИИ подбирает синонимы должностей</Switch>
                <Switch checked={opts.rank} onChange={(v) => setOpts((o) => ({ ...o, rank: v }))}>ИИ отсеивает нерелевантных</Switch>
                <Switch checked={opts.linkedin} onChange={(v) => setOpts((o) => ({ ...o, linkedin: v }))}>Если мало — искать в LinkedIn</Switch>
                <Switch checked={opts.similar} onChange={(v) => setOpts((o) => ({ ...o, similar: v }))}>Искать похожие компании</Switch>
                <div className="grow" />
                <button className="btn btn-ghost btn-sm" onClick={() => { setForm(emptyForm()); setLocTouched(false); setCountSet(false) }}><X size={14} /> Сбросить</button>
              </div>
            </div>
          </div>
        )}
        <div className="composer">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Кого ищем? Например: «Head of Growth в Kalshi» или «SMM в компаниях по типу Stake»"
            value={form.query}
            onChange={(e) => set('query')(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          />
          <div className="composer-bar">
            <button className={`chip ${showFilters ? 'on' : ''}`} onClick={() => setShowFilters((x) => !x)}>
              <SlidersHorizontal size={13} /> Фильтры
              {filterCount(form) > 0 && <span className="badge badge-accent" style={{ height: 17 }}>{filterCount(form)}</span>}
              <ChevronDown size={13} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            <button className="chip" onClick={() => setShowFilters(true)} title="Регион">
              📍 {form.locations.length ? form.locations.join(', ') : 'United States'}
            </button>
            <div className="grow" />
            <span className="small muted hide-sm">Сколько</span>
            <Stepper value={count} onChange={(v) => { setCount(v); setCountSet(true) }} />
            {running ? (
              <button className="send" onClick={() => abortRef.current?.abort()} title="Остановить"><Square size={14} fill="currentColor" /></button>
            ) : (
              <button className="send" disabled={!hasInput} onClick={submit} title="Найти (Enter)"><ArrowUp size={18} /></button>
            )}
          </div>
        </div>
        <div className="dock-hint">Enter — найти · Shift+Enter — новая строка · уже найденные люди не повторяются</div>
      </div>
      <PersonDrawer id={openId} onClose={() => setOpenId(null)} onChanged={mergeAll} />
    </div>
  )
}

function Hero({ onPick }) {
  return (
    <div className="hero">
      <div className="hero-logo"><Sparkles size={26} /></div>
      <h1>Кого ищем?</h1>
      <p className="muted">Опишите словами — агент разберёт запрос, найдёт компании и людей в Apollo, отсеет лишних и не покажет уже найденных.</p>
      <div className="examples-grid">
        {EXAMPLES.map(([q, hint]) => (
          <button key={q} className="example" onClick={() => onPick(q)}>
            <span>{q}</span>
            <span className="small faint">{hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function requestChips(r) {
  return [
    ...(r.companies || []).map((x) => `🏢 ${x}`),
    ...(r.titles || []).map((x) => `👤 ${x}`),
    ...(r.industries || []).map((x) => `🏷 ${x}`),
    ...(r.locations || []).map((x) => `📍 ${x}`),
    ...(r.similar ? ['+ похожие компании'] : []),
    `${r.count} чел.`,
  ]
}

function Turn({ t, setTurn, enrich, busy, onOpen, onMore, onPickCompany, onStop, disabled }) {
  const { toast } = useApp()
  const { run, people } = t
  const sel = t.selected
  const toggle = (id) => setTurn(t.id, (x) => {
    const n = new Set(x.selected); n.has(id) ? n.delete(id) : n.add(id); return { ...x, selected: n }
  })
  const allSel = people.length > 0 && people.every((p) => sel.has(p.apollo_id))
  const selPeople = people.filter((p) => sel.has(p.apollo_id))
  const target = selPeople.length ? selPeople : people
  const toEnrich = target.filter((p) => p.enrich_status !== 'enriched')

  return (
    <div className="turn">
      <div className="msg-user">
        <div className="bubble">
          {t.label && <div>{t.label}</div>}
          <div className="row wrap" style={{ gap: 5, marginTop: t.label ? 8 : 0 }}>
            {requestChips(t.request).map((c) => <span key={c} className="bchip">{c}</span>)}
          </div>
        </div>
      </div>

      <div className="msg-bot">
        <div className="bot-avatar"><Bot size={17} /></div>
        <div className="bot-body">
          <RunPanel run={run} running={t.running} onPickCompany={onPickCompany} onStop={onStop} />

          {people.length > 0 && (
            <>
              <div className="turn-toolbar">
                <button className="btn btn-ghost btn-sm" onClick={() => setTurn(t.id, (x) => ({ ...x, selected: allSel ? new Set() : new Set(people.map((p) => p.apollo_id)) }))}>
                  {allSel ? <CheckSquare size={15} /> : <Square size={15} />} {sel.size ? `Выбрано ${sel.size}` : 'Выбрать все'}
                </button>
                <div className="grow" />
                <button className="btn btn-sm" disabled={disabled} onClick={onMore} title="Ещё столько же новых людей по этому запросу">
                  <RefreshCw size={14} /> Найти ещё
                </button>
                <button className="btn btn-sm" onClick={() => download(`/api/export?fmt=xlsx&ids=${target.map((p) => encodeURIComponent(p.apollo_id)).join(',')}`).catch((e) => toast(e.message, 'error'))}>
                  <Download size={14} /> Excel
                </button>
                <button className="btn btn-primary btn-sm" disabled={!toEnrich.length} onClick={() => enrich(target)}>
                  <Zap size={14} /> Получить контакты{toEnrich.length ? ` (${toEnrich.length})` : ''}
                  {toEnrich.length > 0 && <span style={{ opacity: 0.75, fontWeight: 500 }}>· до {toEnrich.length * COST_PER_PERSON} кр.</span>}
                </button>
              </div>
              <div className="cards">
                {people.map((p, i) => (
                  <PersonCard key={p.apollo_id} p={p} index={i} selected={sel.has(p.apollo_id)} onSelect={toggle}
                    onOpen={(x) => onOpen(x.apollo_id)} onEnrich={enrich} busy={busy.has(p.apollo_id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtTook(s) {
  return s == null ? '' : s < 1 ? `${Math.round(s * 1000)} мс` : `${s.toFixed(1)} с`
}

function RunPanel({ run, running, onPickCompany, onStop }) {
  const [open, setOpen] = useState(true)
  const finished = !running
  useEffect(() => { if (finished && !run.error && run.done?.found > 0) setOpen(false) }, [finished, run.error, run.done])
  const switchable = run.companies.filter((c) => c.candidates?.length > 1)
  const n = run.done?.found ?? 0

  return (
    <div className="card run-card">
      <button className="run-head" onClick={() => setOpen((x) => !x)}>
        {running ? <Loader2 size={16} className="spin" color="var(--accent)" />
          : run.error ? <X size={16} color="var(--red)" /> : <Check size={16} color="var(--green)" />}
        <span className="title">
          {running ? (run.steps.at(-1)?.title || 'Думаю…') : run.error ? 'Ошибка' : n ? `Нашёл ${n} ${plural(n, 'человека', 'человек', 'человек')}` : 'Никого нового не нашёл'}
        </span>
        {run.done && <span className="small muted hide-sm">{fmtTook(run.done.took)} · шагов {run.steps.length}</span>}
        <div className="grow" />
        {running && <span className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onStop() }}>Остановить</span>}
        <ChevronDown size={15} className="faint" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div className="steps">
          {run.steps.map((s) => (
            <div key={s.id} className="step">
              <div className={`step-icon ${s.status}`}>
                {s.status === 'running' ? <Loader2 size={15} className="spin" /> : s.status === 'done' ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              </div>
              <div>
                <div className="step-title">{s.title}</div>
                {s.detail && <div className="step-detail">{s.detail}</div>}
              </div>
              <div className="step-time num">{fmtTook(s.took)}</div>
            </div>
          ))}
        </div>
      )}
      {run.error && <div className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{run.error}</div>}
      {run.done && n === 0 && !run.error && (
        <div className="small muted" style={{ marginTop: 8 }}>
          Подходящие люди уже есть в базе или не нашлись. Попробуйте другие должности, регион или включите поиск в LinkedIn.
        </div>
      )}
      {run.similar?.length > 0 && !running && (
        <div className="company-pick">
          <span className="small muted">Похожие компании:</span>
          {run.similar.map((c) => <span key={c.id} className="badge badge-gray" title={`${c.people} чел. в Apollo`}>{c.name}</span>)}
        </div>
      )}
      {switchable.length > 0 && !running && (
        <div className="company-pick">
          <span className="small muted">Не та компания?</span>
          {switchable.map((c) => (
            <select key={c.query} className="input" style={{ width: 'auto', height: 32, fontSize: 13 }}
              value={c.chosen?.id} onChange={(e) => onPickCompany(c.query, e.target.value)}>
              {c.candidates.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}{o.domain ? ` · ${o.domain}` : ''}{o.people != null ? ` · ${o.people} чел.` : ''}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  )
}
