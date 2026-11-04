import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AtSign, Briefcase, Building2, ExternalLink, EyeOff, Facebook, Github, Globe, Infinity as InfinityIcon, Instagram, Linkedin,
  Loader2, Mail, MapPin, Pencil, Phone, RefreshCw, Sparkles, Twitch, Twitter, X, Youtube, Zap,
} from 'lucide-react'
import { api, COST_PER_PERSON, fmtDate, fmtPhone, personName, plural } from './api'
import { useApp } from './App'
import { Avatar, CopyButton, ScoreBadge } from './ui'

/* Fresh rows replace the old ones; prev_id covers people who got their Apollo id on enrichment. */
export const mergeList = (list, rows) => {
  const map = Object.fromEntries(rows.map((r) => [r.prev_id || r.apollo_id, r]))
  return list.map((p) => (map[p.apollo_id] ? { ...p, ...map[p.apollo_id] } : p))
}
export const mergeInto = (setPeople) => (rows) => setPeople((prev) => mergeList(prev, rows))

/* Polls rows whose phones are still being looked up or whose AI summary is not ready yet. */
export function useLivePeople(people, merge) {
  const ids = people
    .filter((p) => p.phone_status === 'pending' || p.socials_status === 'queued' || p.socials_status === 'pending'
      || (p.enrich_status === 'enriched' && p.summary == null && Date.now() / 1000 - (p.enriched_at || 0) < 600))
    .map((p) => p.apollo_id)
  const key = ids.join(',')
  const mergeRef = useRef(merge)
  mergeRef.current = merge
  useEffect(() => {
    if (!key) return
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/api/people/by-ids?ids=${key}`)
        mergeRef.current(r.items)
      } catch { /* next tick */ }
    }, 4000)
    return () => clearInterval(t)
  }, [key])
}

/* "Get contacts" with a cost confirmation; never re-spends on enriched people. */
export function useEnrich(merge) {
  const { toast, confirm, credits, refreshCredits } = useApp()
  const [busy, setBusy] = useState(() => new Set())
  const run = useCallback(async (ids) => {
    setBusy((b) => new Set([...b, ...ids]))
    try {
      const r = await api.post('/api/people/enrich', { ids })
      merge(r.people)
      const mine = r.people.filter((p) => ids.includes(p.prev_id || p.apollo_id))
      const ok = mine.filter((p) => p.enrich_status === 'enriched').length
      const miss = mine.filter((p) => p.enrich_status === 'no_match').length
      if (r.errors?.length) toast(r.errors[0], 'error')
      else toast(`Контакты получены: ${ok}${miss ? `, не найдено в Apollo: ${miss}` : ''}. Телефоны подгрузятся в течение минуты.`, 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy((b) => { const n = new Set(b); ids.forEach((i) => n.delete(i)); return n })
      refreshCredits(true)
    }
  }, [merge, toast, refreshCredits])

  const enrich = useCallback((people) => {
    const todo = people.filter((p) => p.enrich_status !== 'enriched')
    if (!todo.length) { toast('У выбранных контакты уже получены — повторно кредиты не тратим', 'info'); return }
    const n = todo.length
    const max = n * COST_PER_PERSON
    confirm({
      title: `Получить контакты: ${n} ${plural(n, 'человек', 'человека', 'человек')}`,
      body: (
        <div className="col" style={{ gap: 8 }}>
          <div>Apollo найдёт рабочий и личные email, телефоны и LinkedIn.</div>
          <div>Списание: <b>1 кредит</b> за человека + <b>8</b>, если найдётся мобильный. Максимум — <b className="num">{max}</b>.</div>
          {credits?.left != null && <div className="faint">Сейчас на балансе: <span className="num">{credits.left.toLocaleString('ru-RU')}</span></div>}
          {people.length > n && <div className="faint">{people.length - n} уже с контактами — их пропустим.</div>}
        </div>
      ),
      ok: 'Получить контакты',
      onOk: () => run(todo.map((p) => p.apollo_id)),
    })
  }, [confirm, credits, run, toast])
  return { enrich, busy }
}

export async function hidePeople(ids, hidden = true) {
  await api.post('/api/people/hide', { ids, hidden })
}

/* ---------------------------------------------------------------- contact lines */
function PhoneLines({ p }) {
  if (p.phone_status === 'pending') {
    return <div className="contact-line pending"><Phone size={14} /><span className="muted">Ищем телефон…</span></div>
  }
  if (!p.phones?.length) {
    return p.enrich_status === 'enriched'
      ? <div className="contact-line"><Phone size={14} /><span className="faint">Телефон не найден</span></div>
      : null
  }
  return p.phones.map((ph) => (
    <div key={ph.number} className="contact-line">
      <Phone size={14} />
      <a className="val num" href={`tel:${ph.number}`} onClick={(e) => e.stopPropagation()}>{fmtPhone(ph.number)}</a>
      {ph.type && <span className={`badge ${ph.type === 'mobile' ? 'badge-green' : 'badge-gray'}`}>{ph.type === 'mobile' ? 'мобильный' : ph.type.replace('_', ' ')}</span>}
      {ph.dnc === 'on_dnc' && <span className="badge badge-red" title="Номер в списке Do Not Call">DNC</span>}
      <CopyButton text={ph.number} />
    </div>
  ))
}

const EMAIL_STATUS = { verified: ['подтверждён', 'badge-green'], extrapolated: ['предположительно', 'badge-amber'], likely_to_engage: ['вероятный', 'badge-amber'] }

function EmailLines({ p }) {
  const lines = []
  if (p.email) {
    const st = EMAIL_STATUS[p.email_status]
    lines.push(
      <div key="w" className="contact-line">
        <Mail size={14} />
        <a className="val" href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()}>{p.email}</a>
        {st && <span className={`badge ${st[1]}`}>{st[0]}</span>}
        <CopyButton text={p.email} />
      </div>,
    )
  }
  for (const e of p.personal_emails || []) {
    lines.push(
      <div key={e} className="contact-line">
        <Mail size={14} />
        <a className="val" href={`mailto:${e}`} onClick={(ev) => ev.stopPropagation()}>{e}</a>
        <span className="badge badge-gray">личный</span>
        <CopyButton text={e} />
      </div>,
    )
  }
  if (!lines.length && p.enrich_status === 'enriched') {
    lines.push(<div key="n" className="contact-line"><Mail size={14} /><span className="faint">Email не найден</span></div>)
  }
  return lines
}

export function ContactBlock({ p }) {
  if (p.enrich_status !== 'enriched') return null
  return (
    <div className="contacts">
      <EmailLines p={p} />
      <PhoneLines p={p} />
      {p.linkedin_url && (
        <div className="contact-line">
          <Linkedin size={14} />
          <a className="val" href={p.linkedin_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {p.linkedin_url.replace('https://www.linkedin.com', '')}
          </a>
          <CopyButton text={p.linkedin_url} />
        </div>
      )}
    </div>
  )
}

function Availability({ p }) {
  if (p.enrich_status === 'enriched') return null
  return (
    <div className="avail">
      {p.has_email ? <span className="badge badge-green"><Mail size={11} /> есть email</span> : <span className="badge badge-gray"><Mail size={11} /> email?</span>}
      {p.has_phone === 'Yes' && <span className="badge badge-green"><Phone size={11} /> есть телефон</span>}
      {p.has_phone && p.has_phone !== 'Yes' && <span className="badge badge-amber"><Phone size={11} /> телефон возможен</span>}
      {p.enrich_status === 'no_match' && <span className="badge badge-red">не найден при обогащении</span>}
      {p.enrich_status === 'error' && <span className="badge badge-red" title={p.enrich_error}>ошибка</span>}
    </div>
  )
}

/* ---------------------------------------------------------------- Meta's ecosystem */
export const META_REL = {
  meta: ['Meta', 'badge-meta', 'Сотрудник Meta'],
  family: ['Meta', 'badge-meta', 'Компания группы Meta'],
  contractor: ['Подрядчик Meta', 'badge-meta-c', 'Подрядчик Meta'],
  partner: ['Партнёр Meta', 'badge-meta-p', 'Партнёр Meta'],
}
export const META_WEIGHT = { family: 4, meta: 3, contractor: 2, partner: 1 }

export function MetaBadge({ rel, note }) {
  const m = META_REL[rel]
  if (!m) return null
  return <span className={`badge ${m[1]}`} title={note || m[2]}><InfinityIcon size={12} /> {m[0]}</span>
}

export function SourceBadge({ p }) {
  if (p.source === 'link') return <span className="badge badge-gray">по ссылке</span>
  if (p.source === 'linkedin') return <span className="badge badge-blue"><Linkedin size={11} /> LinkedIn</span>
  return null
}

/* ---------------------------------------------------------------- social networks (maigret) */
const SOCIAL_ICON = { instagram: Instagram, twitter: Twitter, facebook: Facebook, youtube: Youtube, github: Github, twitch: Twitch }
const SOCIAL_STATUS = { confirmed: ['подтверждён', 'badge-green'], likely: ['вероятно', 'badge-amber'], possible: ['возможно', 'badge-gray'] }

export function SocialLinks({ p, full = false, onRecheck }) {
  const st = p.socials_status
  const li = p.linkedin_url && p.enrich_status !== 'enriched'
  const liChip = li && <a className="social li" href={p.linkedin_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Linkedin size={13} /> LinkedIn</a>
  if (!st && !full && !li) return null
  if (st === 'queued' || st === 'pending') {
    return (
      <div className="socials">
        {liChip}
        <span className="small muted row pending" style={{ gap: 6 }}>
          <AtSign size={13} /> {p.linkedin_url ? 'Ищем соцсети' : 'Ищем профиль LinkedIn и соцсети'}{st === 'queued' ? ' (в очереди)' : '…'}
        </span>
      </div>
    )
  }
  const all = p.socials || []
  const sure = all.filter((a) => a.status !== 'possible')
  const shown = full ? all : sure
  if (!shown.length && !li && !full && st !== 'none') return null
  return (
    <div className="socials">
      {liChip}
      {shown.map((a) => {
        const I = SOCIAL_ICON[a.site.toLowerCase()] || Globe
        const [label, cls] = SOCIAL_STATUS[a.status] || SOCIAL_STATUS.possible
        return (
          <a key={a.site + a.url} className={`social ${a.site.toLowerCase() === 'instagram' ? 'ig' : ''}`} href={a.url}
            target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${a.site}: ${a.username} · ${label}`}>
            <I size={13} /> {a.site}
            {full && <span className={`badge ${cls}`} style={{ height: 17 }}>{label}</span>}
          </a>
        )
      })}
      {!full && all.length > sure.length && <span className="small faint">+{all.length - sure.length} возможных</span>}
      {full && st === 'done' && !all.length && <span className="small faint">Не найдено</span>}
      {st === 'none' && (
        <span className="small faint">
          {p.linkedin_url ? 'Соцсети не найдены' : 'Профиль LinkedIn не найден автоматически — точную ссылку даст «Получить контакты»'}
        </span>
      )}
      {full && st === 'error' && <span className="small" style={{ color: 'var(--red)' }}>Ошибка поиска</span>}
      {full && !st && <span className="small faint">Ещё не искали</span>}
      {full && onRecheck && st !== 'queued' && st !== 'pending' && (
        <button className="btn btn-ghost btn-sm" onClick={onRecheck}><RefreshCw size={13} /> Искать заново</button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- card */
export function PersonCard({ p, selected, onSelect, onOpen, onEnrich, busy, index = 0 }) {
  const loc = [p.city, p.state, p.country === 'United States' ? 'USA' : p.country].filter(Boolean).join(', ')
  return (
    <div className={`card pcard ${selected ? 'selected' : ''} ${p.meta_rel ? 'meta' : ''}`} style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      <div className="pcard-head">
        {onSelect && <input type="checkbox" className="checkbox" checked={selected} onChange={() => onSelect(p.apollo_id)} style={{ marginTop: 13 }} />}
        <Avatar person={p} />
        <div className="grow" style={{ cursor: 'pointer' }} onClick={() => onOpen?.(p)}>
          <div className="pname">{personName(p)}</div>
          <div className="ptitle">{p.title || '—'}</div>
          <div className="pcompany">
            <Building2 size={12} /> {p.org_name || '—'}
            {loc && <><MapPin size={12} style={{ marginLeft: 4 }} /> {loc}</>}
          </div>
        </div>
        <div className="score col" style={{ gap: 4, alignItems: 'flex-end' }}>
          <ScoreBadge score={p.score} /><MetaBadge rel={p.meta_rel} note={p.meta_note} /><SourceBadge p={p} />
          {p.lead_status && p.lead_status !== 'new' && <LeadBadge status={p.lead_status} />}
        </div>
      </div>
      {p.meta_rel && p.meta_rel !== 'meta' && p.meta_note && <div className="meta-note">{p.meta_note}</div>}
      {p.match_note && p.source !== 'linkedin' && p.enrich_status !== 'enriched' && (
        <div className="small faint">найден {p.match_note}</div>
      )}
      <Availability p={p} />
      <ContactBlock p={p} />
      <SocialLinks p={p} />
      {p.summary && <div className="summary">{p.summary}</div>}
      {p.enrich_status === 'enriched' && p.summary == null && (
        <div className="small faint row pending" style={{ gap: 6 }}><Sparkles size={13} /> ИИ готовит краткую справку…</div>
      )}
      {p.enrich_status !== 'enriched' && (
        <div className="pcard-foot">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onEnrich([p])}>
            {busy ? <Loader2 size={14} className="spin" /> : <Zap size={14} />} Получить контакты
          </button>
          <span className="small faint">до {COST_PER_PERSON} кредитов</span>
        </div>
      )}
    </div>
  )
}


export const LEAD_STATUS = {
  new: ['Новый', 'badge-gray'],
  in_progress: ['В работе', 'badge-accent'],
  contacted: ['Связались', 'badge-blue'],
  replied: ['Ответил', 'badge-green'],
  not_interested: ['Не интересно', 'badge-red'],
}

export function LeadBadge({ status }) {
  const [label, cls] = LEAD_STATUS[status || 'new'] || LEAD_STATUS.new
  return <span className={`badge ${cls}`}>{label}</span>
}

const FIELD_RU = {
  name: 'Имя', title: 'Должность', org_name: 'Компания', email: 'Email', phones: 'Телефоны',
  notes: 'Заметки', lead_status: 'Статус',
}

/* A value that turns into an input on click and is saved on Enter / blur. */
function EditField({ label, value, onSave, multiline, placeholder }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value || '')
  useEffect(() => { if (!editing) setText(value || '') }, [value, editing])
  const save = async () => {
    setEditing(false)
    if ((text || '').trim() !== (value || '').trim()) await onSave(text)
  }
  return (
    <div className="edit-field">
      <div className="edit-label">{label}</div>
      {editing ? (
        multiline ? (
          <textarea className="input" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Escape') { setText(value || ''); setEditing(false) } }} />
        ) : (
          <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setText(value || ''); setEditing(false) }
            }} />
        )
      ) : (
        <button className="edit-value" onClick={() => setEditing(true)} title="Изменить">
          {value ? <span style={{ whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>{value}</span> : <span className="faint">{placeholder || '—'}</span>}
          <Pencil size={12} className="edit-pen" />
        </button>
      )}
    </div>
  )
}

function eventText(e) {
  if (e.kind === 'found') return ['Найден в поиске', e.detail]
  if (e.kind === 'found_again') return ['Снова найден в поиске', e.detail]
  if (e.kind === 'linkedin') return ['Найден профиль LinkedIn (бесплатно)', e.detail]
  if (e.kind === 'socials') return ['Соцсети (Maigret)', e.detail]
  if (e.kind === 'enriched') return ['Получены контакты', e.detail]
  if (e.kind === 'phones') return ['Телефоны', e.detail]
  if (e.kind === 'hidden') return ['Скрыт', null]
  if (e.kind === 'shown') return ['Возвращён из скрытых', null]
  if (e.kind === 'edit') {
    const fmt = (v) => {
      if (v == null || v === '') return '—'
      if (e.field === 'lead_status') return (LEAD_STATUS[v] || [v])[0]
      return v.length > 80 ? `${v.slice(0, 80)}…` : v
    }
    return [`Изменено: ${FIELD_RU[e.field] || e.field}`, `${fmt(e.old)} → ${fmt(e.new)}`]
  }
  return [e.kind, e.detail]
}

function HistoryList({ id, version }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    api.get(`/api/people/${encodeURIComponent(id)}/events`).then((r) => setItems(r.items)).catch(() => setItems([]))
  }, [id, version])
  if (!items) return <div className="skeleton" style={{ height: 40 }} />
  if (!items.length) return <div className="small faint">Пока нет записей</div>
  return (
    <div className="history">
      {items.map((e, i) => {
        const [title, detail] = eventText(e)
        return (
          <div key={i} className="hist-row">
            <i />
            <div>
              <div className="small"><b>{title}</b> <span className="faint">· {fmtDate(e.ts)}</span></div>
              {detail && <div className="small muted" style={{ wordBreak: 'break-word' }}>{detail}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- person card (modal) */
export function PersonDrawer({ id, onClose, onChanged, onHidden }) {
  const [p, setP] = useState(null)
  const [version, setVersion] = useState(0)
  const { toast } = useApp()
  const merge = useCallback((rows) => rows[0] && setP((x) => ({ ...x, ...rows[0] })), [])
  const { enrich, busy } = useEnrich((rows) => { merge(rows); onChanged?.(rows); setVersion((v) => v + 1) })
  useLivePeople(p ? [p] : [], (rows) => { merge(rows); onChanged?.(rows) })

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!id) return
    setP(null)
    api.get(`/api/people/${encodeURIComponent(id)}`).then(setP).catch((e) => toast(e.message, 'error'))
    const h = (e) => e.key === 'Escape' && !e.target.closest?.('input, textarea') && closeRef.current()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [id, toast])

  const save = async (patch) => {
    try {
      const row = await api.patch(`/api/people/${encodeURIComponent(p.apollo_id)}`, patch)
      merge([row])
      onChanged?.([row])
      setVersion((v) => v + 1)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (!id) return null
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="pmodal" role="dialog">
        {!p ? (
          <div className="col"><div className="skeleton" style={{ height: 50 }} /><div className="skeleton" style={{ height: 160 }} /></div>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Avatar person={p} />
              <div className="grow">
                <h2>{personName(p)}</h2>
                <div className="muted">{p.headline || p.title}</div>
              </div>
              <select className="input" style={{ width: 'auto', height: 32, fontSize: 13 }} value={p.lead_status || 'new'}
                onChange={(e) => save({ lead_status: e.target.value })} title="Статус работы с контактом">
                {Object.entries(LEAD_STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
            </div>
            {p.meta_note && <div className={p.meta_rel ? 'meta-note' : 'small faint'} style={{ marginTop: 12 }}>{p.meta_note}</div>}
            <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
              <ScoreBadge score={p.score} />
              <MetaBadge rel={p.meta_rel} note={p.meta_note} />
              {p.seniority && <span className="badge badge-accent">{p.seniority}</span>}
              <SourceBadge p={p} />
              {(p.city || p.state || p.country) && <span className="badge badge-gray"><MapPin size={11} /> {[p.city, p.state, p.country].filter(Boolean).join(', ')}</span>}
              <span className="badge badge-gray">найден {fmtDate(p.found_at)}</span>
              {p.enriched_at && <span className="badge badge-gray">обогащён {fmtDate(p.enriched_at)}</span>}
            </div>

            <div className="pmodal-grid">
              <div>
                {p.summary && <><div className="section-title">Кратко (ИИ)</div><div className="summary">{p.summary}</div></>}

                <div className="section-title">Контакты</div>
                {p.enrich_status === 'enriched' ? <ContactBlock p={p} /> : (
                  <div className="col">
                    <Availability p={p} />
                    <div className="row">
                      <button className="btn btn-primary" disabled={busy.has(p.apollo_id)} onClick={() => enrich([p])}>
                        {busy.has(p.apollo_id) ? <Loader2 size={15} className="spin" /> : <Zap size={15} />} Получить контакты
                      </button>
                      <span className="small faint">до {COST_PER_PERSON} кредитов</span>
                    </div>
                  </div>
                )}

                <div className="section-title">LinkedIn и соцсети</div>
                <SocialLinks p={p} full onRecheck={async () => {
                  try { merge([await api.post(`/api/people/${encodeURIComponent(p.apollo_id)}/socials`)]) } catch (e) { toast(e.message, 'error') }
                }} />

                <div className="section-title">Данные (можно править)</div>
                <div className="edit-grid">
                  <EditField label="Имя" value={p.name || personName(p)} onSave={(v) => save({ name: v })} />
                  <EditField label="Должность" value={p.title} onSave={(v) => save({ title: v })} />
                  <EditField label="Компания" value={p.org_name} onSave={(v) => save({ org_name: v })} />
                  <EditField label="Email" value={p.email} placeholder="добавить email" onSave={(v) => save({ email: v })} />
                  <EditField label="Телефоны" value={(p.phones || []).map((x) => x.number).join(', ')} placeholder="добавить через запятую"
                    onSave={(v) => save({ phones: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
                </div>
                <EditField label="Заметки" multiline value={p.notes} placeholder="добавить заметку" onSave={(v) => save({ notes: v })} />
              </div>

              <div>
                <div className="section-title">Компания</div>
                <dl className="kv" style={{ marginTop: 0 }}>
                  <dt>Название</dt><dd>{p.org_name || '—'}</dd>
                  {p.org_domain && <><dt>Сайт</dt><dd><a href={`https://${p.org_domain}`} target="_blank" rel="noreferrer">{p.org_domain} <ExternalLink size={11} /></a></dd></>}
                  {p.org_industry && <><dt>Отрасль</dt><dd>{p.org_industry}</dd></>}
                  {p.org_size && <><dt>Сотрудников</dt><dd className="num">{p.org_size.toLocaleString('ru-RU')}</dd></>}
                  {p.org_linkedin && <><dt>LinkedIn</dt><dd><a href={p.org_linkedin} target="_blank" rel="noreferrer">страница компании <ExternalLink size={11} /></a></dd></>}
                </dl>

                {p.employment?.length > 0 && (
                  <>
                    <div className="section-title">Опыт</div>
                    <div className="jobs">
                      {p.employment.map((j, i) => (
                        <div key={i} className={`job ${j.current ? 'current' : ''}`}>
                          <i />
                          <div>
                            <div style={{ fontWeight: 600 }}><Briefcase size={12} style={{ marginRight: 6, verticalAlign: -1 }} />{j.title || '—'}</div>
                            <div className="small muted">{j.organization_name} · {(j.start_date || '').slice(0, 7)} — {j.current ? 'н.в.' : (j.end_date || '').slice(0, 7)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="section-title">История изменений</div>
                <HistoryList id={p.apollo_id} version={version} />
              </div>
            </div>

            <div className="row" style={{ marginTop: 22 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await hidePeople([p.apollo_id], !p.hidden)
                  setP({ ...p, hidden: p.hidden ? 0 : 1 })
                  onChanged?.([{ ...p, hidden: p.hidden ? 0 : 1 }])
                  onHidden?.()
                  setVersion((v) => v + 1)
                  toast(p.hidden ? 'Возвращён в базу' : 'Скрыт: больше не появится в поиске и списках', 'info')
                }}
              >
                <EyeOff size={14} /> {p.hidden ? 'Вернуть из скрытых' : 'Скрыть'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
