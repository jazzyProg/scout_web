import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2, Coins, Contact, Download, Infinity as InfinityIcon, Linkedin, Loader2, Mail, Phone, Search, Sparkles, Users, X, Zap,
} from 'lucide-react'
import { api, download, fmtDate, fmtPhone, personName } from '../api'
import { useApp } from '../App'
import { LEAD_STATUS, LeadBadge, MetaBadge, mergeInto, PersonDrawer, useEnrich, useLivePeople } from '../people'
import { Avatar, CopyButton, ScoreBadge } from '../ui'

const VIEWS = [
  ['contacts', 'С контактами', 'enriched'],
  ['phones', 'С телефоном', 'phones'],
  ['new', 'Без контактов', null],
  ['all', 'Все найденные', 'total'],
  ['hidden', 'Скрытые', null],
]
const META_FILTERS = [
  ['', 'Все компании'],
  ['any', 'Экосистема Meta'],
  ['meta', 'Сотрудники Meta'],
  ['contractor', 'Подрядчики Meta'],
  ['partner', 'Партнёры Meta'],
]
const PAGE = 50

export default function ContactsPage() {
  const { stats, refreshCredits, toast, searchIn } = useApp()
  const [mode, setMode] = useState('people') // people | orgs
  const [view, setView] = useState('contacts')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('enriched')
  const [status, setStatus] = useState('')
  const [metaRel, setMetaRel] = useState('')
  const [orgs, setOrgs] = useState([]) // company filter: names exactly as in the list
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set())
  const [openId, setOpenId] = useState(null)
  const merge = useMemo(() => mergeInto(setItems), [])
  const { enrich, busy } = useEnrich(merge)
  useLivePeople(items, merge)

  const params = `view=${view}&q=${encodeURIComponent(q)}&status=${status}&meta_rel=${metaRel}&org=${encodeURIComponent(orgs.join('|'))}`
  const load = useCallback(async (offset = 0) => {
    setLoading(true)
    try {
      const r = await api.get(`/api/people?${params}&sort=${sort}&limit=${PAGE}&offset=${offset}`)
      setItems((prev) => (offset ? [...prev, ...r.items] : r.items))
      setTotal(r.total)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [params, sort, toast])

  useEffect(() => {
    if (mode !== 'people') return undefined
    const t = setTimeout(() => load(0), q ? 250 : 0)
    setSelected(new Set())
    return () => clearTimeout(t)
  }, [load, q, mode])
  useEffect(() => { refreshCredits() }, [refreshCredits])

  const showOrgs = (names) => {
    setOrgs(names)
    setView('all')
    setMode('people')
  }

  const selPeople = items.filter((p) => selected.has(p.apollo_id))
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSel = items.length > 0 && items.every((p) => selected.has(p.apollo_id))
  const exportUrl = (fmt) => selPeople.length
    ? `/api/export?fmt=${fmt}&ids=${selPeople.map((p) => encodeURIComponent(p.apollo_id)).join(',')}`
    : `/api/export?fmt=${fmt}&${params}&sort=${sort}`

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Контакты</h1>
          <p>Все люди, которых находил агент, и их компании. Повторно они в поиск не попадают, а за контакты не платим дважды.</p>
        </div>
      </div>

      <div className="stats">
        <Stat icon={Users} k="Всего найдено" v={stats?.total} />
        <Stat icon={Contact} k="С контактами" v={stats?.enriched} />
        <Stat icon={Phone} k="С телефоном" v={stats?.phones} />
        <Stat icon={Linkedin} k="С LinkedIn (бесплатно)" v={stats?.linkedin} />
        <Stat icon={InfinityIcon} k="Экосистема Meta" v={stats?.meta} accent />
        <Stat icon={Coins} k="Потрачено кредитов" v={stats?.credits_spent} />
      </div>

      <div className="row wrap" style={{ gap: 10, marginBottom: 12 }}>
        <div className="seg">
          <button className={mode === 'people' ? 'on' : ''} onClick={() => setMode('people')}><Users size={14} /> Люди</button>
          <button className={mode === 'orgs' ? 'on' : ''} onClick={() => setMode('orgs')}><Building2 size={14} /> По компаниям</button>
        </div>
        {mode === 'people' && (
          <div className="seg">
            {VIEWS.map(([id, label, key]) => (
              <button key={id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>
                {label}{key && stats?.[key] != null && <span className="count num">{stats[key]}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'orgs' ? (
        <OrgsView metaRel={metaRel} setMetaRel={setMetaRel} onShow={showOrgs}
          onSearch={(names, isMeta) => searchIn({ companies: names, meta: false, query: '', isMeta })} />
      ) : (
        <>
          <div className="row wrap" style={{ gap: 10 }}>
            <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-3)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Имя, компания, email, телефон" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" style={{ width: 'auto' }} value={metaRel} onChange={(e) => setMetaRel(e.target.value)}>
              {META_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Любой статус</option>
              {Object.entries(LEAD_STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="enriched">Сначала обогащённые</option>
              <option value="meta">Сначала Meta</option>
              <option value="found">Сначала новые</option>
              <option value="score">По релевантности</option>
              <option value="company">По компании</option>
              <option value="name">По имени</option>
            </select>
          </div>
          {orgs.length > 0 && (
            <div className="org-filter">
              <span className="small muted"><Building2 size={13} style={{ verticalAlign: -2 }} /> Только компании:</span>
              {orgs.map((o) => (
                <button key={o} className="chip on" onClick={() => setOrgs(orgs.filter((x) => x !== o))} title="Убрать">{o} <X size={12} /></button>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setOrgs([])}>Сбросить</button>
              <button className="btn btn-sm" onClick={() => searchIn({ companies: orgs, query: '' })}><Sparkles size={13} /> Найти ещё людей в {orgs.length > 1 ? 'этих компаниях' : 'этой компании'}</button>
            </div>
          )}

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
                <h3>{q || orgs.length || metaRel ? 'Ничего не найдено' : 'Пока пусто'}</h3>
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
                              <div style={{ fontWeight: 600 }} className="row">
                                {personName(p)} <ScoreBadge score={p.score} />
                                {p.linkedin_url && (
                                  <a href={p.linkedin_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Профиль LinkedIn" className="faint">
                                    <Linkedin size={13} />
                                  </a>
                                )}
                              </div>
                              <div className="small muted cell-clip">{p.title}</div>
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => { if (p.org_name) { e.stopPropagation(); setOrgs([p.org_name]) } }} title={p.org_name ? 'Показать только эту компанию' : ''}>
                          <div className="cell-clip org-link">{p.org_name || '—'}</div>
                          <div className="row" style={{ gap: 6 }}>
                            <MetaBadge rel={p.meta_rel} note={p.meta_note} />
                            {!p.meta_rel && <span className="small faint">{p.org_domain}</span>}
                          </div>
                        </td>
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
        </>
      )}
      <PersonDrawer id={openId} onClose={() => setOpenId(null)} onChanged={merge} onHidden={() => load(0)} />
    </div>
  )
}

/* Companies of everybody found: how many people, how far they got; open their people or search for more there. */
function OrgsView({ metaRel, setMetaRel, onShow, onSearch }) {
  const { toast } = useApp()
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const metaOnly = metaRel !== ''

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/api/orgs?q=${encodeURIComponent(q)}&meta_only=${metaOnly ? 1 : 0}`)
        .then((r) => setItems(r.items)).catch((e) => toast(e.message, 'error'))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, metaOnly, toast])

  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x })
  const names = [...sel]

  return (
    <>
      <div className="row wrap" style={{ gap: 10 }}>
        <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Название компании" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={`chip ${metaOnly ? 'on meta-chip' : ''}`} onClick={() => setMetaRel(metaOnly ? '' : 'any')}>
          <InfinityIcon size={13} /> Только экосистема Meta
        </button>
      </div>
      <div className="toolbar">
        <span className="small muted">{sel.size ? `Выбрано компаний: ${sel.size}` : `${items?.length ?? '…'} компаний`}</span>
        <div className="grow" />
        {sel.size > 0 && (
          <>
            <button className="btn btn-sm" onClick={() => onShow(names)}><Users size={14} /> Показать людей</button>
            <button className="btn btn-primary btn-sm" onClick={() => onSearch(names)}><Sparkles size={14} /> Найти ещё людей</button>
          </>
        )}
      </div>
      <div className="card">
        {!items ? <div className="row" style={{ justifyContent: 'center', padding: 16 }}><Loader2 className="spin" size={18} /></div>
          : items.length === 0 ? (
            <div className="empty"><Building2 size={36} /><h3>Компаний нет</h3><div>Они появятся после поиска людей.</div></div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Компания</th>
                    <th className="num">Людей</th>
                    <th className="num">С контактами</th>
                    <th className="num">С телефоном</th>
                    <th className="num">С LinkedIn</th>
                    <th>Последний найден</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.name} className={sel.has(o.name) ? 'selected' : ''} onClick={() => onShow([o.name])} title="Показать людей этой компании">
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="checkbox" checked={sel.has(o.name)} onChange={() => toggle(o.name)} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.name}</div>
                        <div className="row" style={{ gap: 6 }}>
                          <MetaBadge rel={o.meta_org || o.meta_rel} note={o.meta_category} />
                          {o.meta_category && <span className="small muted">{o.meta_category}</span>}
                          {o.domain && <span className="small faint">{o.domain}</span>}
                        </div>
                      </td>
                      <td className="num">{o.people}</td>
                      <td className="num">{o.enriched || <span className="faint">0</span>}</td>
                      <td className="num">{o.phones || <span className="faint">0</span>}</td>
                      <td className="num">{o.linkedin || <span className="faint">0</span>}</td>
                      <td className="small muted nowrap">{fmtDate(o.last_found)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => onSearch([o.name])} title="Новый поиск людей в этой компании">
                          <Sparkles size={13} /> Ещё
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  )
}

function Stat({ icon: I, k, v, accent }) {
  return (
    <div className={`card stat ${accent ? 'stat-meta' : ''}`}>
      <div className="k"><I size={14} /> {k}</div>
      <div className="v num">{v == null ? '—' : v.toLocaleString('ru-RU')}</div>
    </div>
  )
}
