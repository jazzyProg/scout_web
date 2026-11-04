import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coins, Contact, Download, Loader2, Mail, Phone, Search, Users, Zap } from 'lucide-react'
import { api, download, fmtDate, fmtPhone, personName } from '../api'
import { useApp } from '../App'
import { LEAD_STATUS, LeadBadge, mergeInto, PersonDrawer, useEnrich, useLivePeople } from '../people'
import { Avatar, CopyButton, ScoreBadge } from '../ui'

const VIEWS = [
  ['contacts', 'С контактами', 'enriched'],
  ['phones', 'С телефоном', 'phones'],
  ['new', 'Без контактов', null],
  ['all', 'Все найденные', 'total'],
  ['hidden', 'Скрытые', null],
]
const PAGE = 50

export default function ContactsPage() {
  const { stats, refreshCredits, toast } = useApp()
  const [view, setView] = useState('contacts')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('enriched')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set())
  const [openId, setOpenId] = useState(null)
  const merge = useMemo(() => mergeInto(setItems), [])
  const { enrich, busy } = useEnrich(merge)
  useLivePeople(items, merge)

  const load = useCallback(async (offset = 0) => {
    setLoading(true)
    try {
      const r = await api.get(`/api/people?view=${view}&q=${encodeURIComponent(q)}&sort=${sort}&status=${status}&limit=${PAGE}&offset=${offset}`)
      setItems((prev) => (offset ? [...prev, ...r.items] : r.items))
      setTotal(r.total)
    } finally {
      setLoading(false)
    }
  }, [view, q, sort, status])

  useEffect(() => {
    const t = setTimeout(() => load(0), q ? 250 : 0)
    setSelected(new Set())
    return () => clearTimeout(t)
  }, [load, q])
  useEffect(() => { refreshCredits() }, [refreshCredits])

  const selPeople = items.filter((p) => selected.has(p.apollo_id))
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSel = items.length > 0 && items.every((p) => selected.has(p.apollo_id))
  const exportUrl = (fmt) => selPeople.length
    ? `/api/export?fmt=${fmt}&ids=${selPeople.map((p) => encodeURIComponent(p.apollo_id)).join(',')}`
    : `/api/export?fmt=${fmt}&view=${view}&q=${encodeURIComponent(q)}&status=${status}`

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Контакты</h1>
          <p>Все люди, которых находил агент. Повторно они в поиск не попадают, а за контакты не платим дважды.</p>
        </div>
      </div>

      <div className="stats">
        <Stat icon={Users} k="Всего найдено" v={stats?.total} />
        <Stat icon={Contact} k="С контактами" v={stats?.enriched} />
        <Stat icon={Mail} k="С email" v={stats?.emails} />
        <Stat icon={Phone} k="С телефоном" v={stats?.phones} />
        <Stat icon={Coins} k="Потрачено кредитов" v={stats?.credits_spent} />
      </div>

      <div className="row wrap" style={{ gap: 10 }}>
        <div className="seg">
          {VIEWS.map(([id, label, key]) => (
            <button key={id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>
              {label}{key && stats?.[key] != null && <span className="count num">{stats[key]}</span>}
            </button>
          ))}
        </div>
        <div className="grow" />
        <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Имя, компания, email, телефон" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Любой статус</option>
          {Object.entries(LEAD_STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="enriched">Сначала обогащённые</option>
          <option value="found">Сначала новые</option>
          <option value="score">По релевантности</option>
          <option value="company">По компании</option>
          <option value="name">По имени</option>
        </select>
      </div>

      <div className="toolbar">
        <input type="checkbox" className="checkbox" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(items.map((p) => p.apollo_id)))} />
        <span className="small muted">{selected.size ? `Выбрано ${selected.size}` : `${total} в списке`}</span>
        <div className="grow" />
        {selPeople.some((p) => p.enrich_status !== 'enriched') && (
          <button className="btn btn-primary btn-sm" onClick={() => enrich(selPeople)}>
            <Zap size={14} /> Получить контакты ({selPeople.filter((p) => p.enrich_status !== 'enriched').length})
          </button>
        )}
        <button className="btn btn-sm" onClick={() => download(exportUrl('xlsx')).catch((e) => toast(e.message, 'error'))}><Download size={14} /> Excel</button>
        <button className="btn btn-sm" onClick={() => download(exportUrl('csv')).catch((e) => toast(e.message, 'error'))}><Download size={14} /> CSV</button>
      </div>

      <div className="card">
        {items.length === 0 && !loading ? (
          <div className="empty">
            <Contact size={36} />
            <h3>{q ? 'Ничего не найдено' : 'Пока пусто'}</h3>
            <div>{view === 'contacts' ? 'Найдите людей во вкладке «Поиск» и нажмите «Получить контакты».' : 'Здесь появятся люди из поисков.'}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Человек</th>
                  <th>Компания</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Статус</th>
                  <th>Найден</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.apollo_id} className={selected.has(p.apollo_id) ? 'selected' : ''} onClick={() => setOpenId(p.apollo_id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="checkbox" checked={selected.has(p.apollo_id)} onChange={() => toggle(p.apollo_id)} />
                    </td>
                    <td>
                      <div className="cell-person">
                        <Avatar person={p} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }} className="row" >{personName(p)} <ScoreBadge score={p.score} /></div>
                          <div className="small muted cell-clip">{p.title}</div>
                        </div>
                      </div>
                    </td>
                    <td><div className="cell-clip">{p.org_name || '—'}</div><div className="small faint">{p.org_domain}</div></td>
                    <td>
                      {p.email ? <div className="contact-line"><span className="cell-clip">{p.email}</span><CopyButton text={p.email} /></div>
                        : p.personal_emails?.[0] ? <div className="contact-line"><span className="cell-clip">{p.personal_emails[0]}</span><CopyButton text={p.personal_emails[0]} /></div>
                          : <span className="faint">—</span>}
                      {p.personal_emails?.length > (p.email ? 0 : 1) && <div className="small faint">+ {p.personal_emails.length - (p.email ? 0 : 1)} личн.</div>}
                    </td>
                    <td>
                      {p.phone_status === 'pending' ? <span className="small muted pending">ищем…</span>
                        : p.phones?.length ? (
                          <div className="contact-line"><span className="num nowrap">{fmtPhone(p.phones[0].number)}</span><CopyButton text={p.phones[0].number} /></div>
                        ) : <span className="faint">—</span>}
                    </td>
                    <td><LeadBadge status={p.lead_status} /></td>
                    <td className="small muted nowrap">{fmtDate(p.found_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {p.enrich_status !== 'enriched' && (
                        <button className="btn btn-sm" disabled={busy.has(p.apollo_id)} onClick={() => enrich([p])} title="Получить контакты">
                          {busy.has(p.apollo_id) ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loading && <div className="row" style={{ justifyContent: 'center', padding: 16 }}><Loader2 className="spin" size={18} /></div>}
      </div>
      {items.length < total && !loading && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button className="btn" onClick={() => load(items.length)}>Показать ещё ({total - items.length})</button>
        </div>
      )}
      <PersonDrawer id={openId} onClose={() => setOpenId(null)} onChanged={merge} onHidden={() => load(0)} />
    </div>
  )
}

function Stat({ icon: I, k, v }) {
  return (
    <div className="card stat">
      <div className="k"><I size={14} /> {k}</div>
      <div className="v num">{v == null ? '—' : v.toLocaleString('ru-RU')}</div>
    </div>
  )
}
