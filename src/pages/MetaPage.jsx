import { useCallback, useEffect, useState } from 'react'
import {
  Check, ChevronDown, Infinity as InfinityIcon, Loader2, Plus, RefreshCw, RotateCcw, Sparkles, X,
} from 'lucide-react'
import { api, fmtDate } from '../api'
import { useApp } from '../App'
import { MetaBadge } from '../people'

const SOURCE = { builtin: 'встроено', apollo: 'по должностям в Apollo', ai: 'знания ИИ + проверка в Apollo', manual: 'добавлено вручную' }

export default function MetaPage() {
  const { toast, searchIn } = useApp()
  const [data, setData] = useState(null)
  const load = useCallback(async () => {
    try { setData(await api.get('/api/meta')) } catch (e) { toast(e.message, 'error') }
  }, [toast])
  useEffect(() => { load() }, [load])
  const running = data?.state?.running
  useEffect(() => {
    if (!running) return undefined
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [running, load])

  const research = async () => {
    try {
      const st = await api.post('/api/meta/research')
      setData((d) => ({ ...d, state: st }))
    } catch (e) { toast(e.message, 'error') }
  }
  const setStatus = async (o, status) => {
    try { setData(await api.patch(`/api/meta/orgs/${encodeURIComponent(o.key)}`, { status })) } catch (e) { toast(e.message, 'error') }
  }
  const search = (o) => searchIn({ companies: [o.domain || o.name], query: '' })

  if (!data) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>
  const orgs = data.orgs
  const family = orgs.filter((o) => o.relation === 'family').sort((a, b) => (b.apollo_people || 0) - (a.apollo_people || 0))
  const active = (rel) => orgs.filter((o) => o.relation === rel && o.usable)
  const unconfirmed = orgs.filter((o) => o.relation !== 'family' && !o.usable && o.status !== 'rejected')
  const rejected = orgs.filter((o) => o.status === 'rejected')
  const st = data.state

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1 className="row" style={{ gap: 10 }}><span className="meta-logo"><InfinityIcon size={20} /></span> Экосистема Meta</h1>
          <p>
            Компании группы Meta, её подрядчики и партнёры. Люди из них отмечаются во всех результатах, идут первыми,
            а их LinkedIn и соцсети ищутся в первую очередь.
          </p>
        </div>
        <button className="btn" onClick={research} disabled={running}>
          <RefreshCw size={14} className={running ? 'spin' : ''} /> {running ? 'Ресерч идёт…' : 'Обновить ресерч'}
        </button>
        <button className="btn" onClick={() => searchIn({ meta: true, query: '' })}>
          <Sparkles size={14} /> Вся экосистема
        </button>
        <button className="btn btn-primary" onClick={() => searchIn({ mode: 'unban', query: 'Кто в Meta и у подрядчиков занимается разбаном и проверкой аккаунтов Instagram' })}>
          <Sparkles size={14} /> Кто разбанивает Instagram
        </button>
      </div>

      <div className="card card-pad meta-how">
        {running ? (
          <div className="row" style={{ gap: 10 }}><Loader2 size={16} className="spin" color="var(--accent)" /><b>{st.step || 'работаю'}</b></div>
        ) : (
          <div className="small muted">
            {st?.last_at ? <>Последний ресерч: <b>{fmtDate(st.last_at)}</b>. </> : 'Ресерч ещё не проводился. '}
            {st?.error && <span style={{ color: 'var(--red)' }}>Ошибка: {st.error}. </span>}
            {st?.summary && <>Нашёл подрядчиков: <b>{st.summary.contractors}</b>, партнёров: <b>{st.summary.partners}</b>, должностей-доказательств: <b>{st.summary.evidence}</b>. </>}
          </div>
        )}
        <div className="small faint" style={{ marginTop: 8 }}>
          Как ищем: в бесплатном поиске Apollo люди сами пишут «On Assignment at Meta», «Supporting Meta», «Contractor at Meta»…
          Их работодатели — подрядчики Meta; ИИ только определяет, чем они занимаются. Компании, которые ИИ знает сам,
          остаются в списке, только если в Apollo есть их сотрудники с Meta/Facebook/Instagram в должности. Кредиты не тратятся.
        </div>
      </div>

      <Section title="Группа Meta" hint="Сотрудники с этих компаний — «Meta». Блогеры и владельцы бизнеса, указавшие Instagram местом работы, отсеиваются.">
        <div className="meta-grid">
          {family.map((o) => (
            <div key={o.key} className="card card-pad meta-fam">
              <div className="row"><MetaBadge rel="family" /><b>{o.name}</b><div className="grow" /><span className="small faint">{o.domain}</span></div>
              <div className="small muted" style={{ marginTop: 8 }}>
                в мире по Apollo: <b className="num">{(o.apollo_people ?? 0).toLocaleString('ru-RU')}</b> · у нас в базе: <b className="num">{o.in_base}</b>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => search(o)}><Sparkles size={13} /> Искать людей</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Подрядчики Meta · ${active('contractor').length}`} hint="Работают на саму Meta: кадровые агентства, модерация, разметка данных, IT, рекрутинг. В крупных компаниях отмечаются только люди, у которых Meta указана в должности.">
        <OrgTable rows={active('contractor')} onStatus={setStatus} onSearch={search} />
      </Section>

      <Section title={`Партнёры Meta · ${active('partner').length}`} hint="Строят на продуктах Meta для своих клиентов: рекламные и креатор-платформы, агентства, партнёры Instagram.">
        <OrgTable rows={active('partner')} onStatus={setStatus} onSearch={search} />
      </Section>

      <AddOrg onAdded={setData} />

      {unconfirmed.length > 0 && (
        <Section title={`Не подтверждено · ${unconfirmed.length}`} hint="ИИ считает их подрядчиками или партнёрами, но в Apollo нет людей с Meta в должности. Подтвердите, если знаете точно." collapsed>
          <OrgTable rows={unconfirmed} onStatus={setStatus} onSearch={search} />
        </Section>
      )}
      {rejected.length > 0 && (
        <Section title={`Исключено · ${rejected.length}`} hint="Не считаются связанными с Meta." collapsed>
          <OrgTable rows={rejected} onStatus={setStatus} onSearch={search} />
        </Section>
      )}
    </div>
  )
}

function Section({ title, hint, collapsed = false, children }) {
  const [open, setOpen] = useState(!collapsed)
  return (
    <div style={{ marginTop: 22 }}>
      <button className="section-head" onClick={() => setOpen((x) => !x)}>
        <span>{title}</span>
        <ChevronDown size={15} className="faint" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {hint && <div className="small muted" style={{ margin: '4px 0 10px' }}>{hint}</div>}
      {open && children}
    </div>
  )
}

function OrgTable({ rows, onStatus, onSearch }) {
  const [open, setOpen] = useState(null)
  if (!rows.length) return <div className="card card-pad small faint">Пока пусто — запустите ресерч или добавьте компанию вручную.</div>
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Компания</th>
              <th>Доказательства</th>
              <th className="num">Всего в Apollo</th>
              <th className="num">У нас</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.key} onClick={() => setOpen(open === o.key ? null : o.key)}>
                <td style={{ minWidth: 220 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <b>{o.name}</b>
                    {o.status === 'confirmed' && <span className="badge badge-green">подтверждено</span>}
                  </div>
                  <div className="small muted">{o.category || '—'}{o.domain ? ` · ${o.domain}` : ''}</div>
                  <div className="small faint">{SOURCE[o.source] || o.source}</div>
                </td>
                <td style={{ maxWidth: 420 }}>
                  {o.evidence_count > 0 ? (
                    <>
                      <div className="small"><b className="num">{o.evidence_count}</b> чел. с Meta в должности</div>
                      {(open === o.key ? o.evidence : o.evidence.slice(0, 2)).map((e, i) => (
                        <div key={i} className="small faint cell-clip" style={{ maxWidth: 400 }} title={e.title}>«{e.title}»</div>
                      ))}
                      {o.evidence.length > 2 && open !== o.key && <div className="small faint">ещё примеры — нажмите на строку</div>}
                    </>
                  ) : <span className="small faint">нет</span>}
                </td>
                <td className="num">{o.apollo_people != null ? o.apollo_people.toLocaleString('ru-RU') : '—'}</td>
                <td className="num">{o.in_base || <span className="faint">0</span>}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm" onClick={() => onSearch(o)} title="Новый поиск людей в этой компании"><Sparkles size={13} /> Искать</button>
                    {o.status !== 'confirmed' && o.status !== 'rejected' && (
                      <button className="btn btn-ghost btn-sm icon-btn" title="Подтвердить" onClick={() => onStatus(o, 'confirmed')}><Check size={14} /></button>
                    )}
                    {o.status !== 'rejected' ? (
                      <button className="btn btn-ghost btn-sm icon-btn" title="Исключить — не связаны с Meta" onClick={() => onStatus(o, 'rejected')}><X size={14} /></button>
                    ) : (
                      <button className="btn btn-ghost btn-sm icon-btn" title="Вернуть" onClick={() => onStatus(o, 'auto')}><RotateCcw size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AddOrg({ onAdded }) {
  const { toast } = useApp()
  const [f, setF] = useState({ name: '', domain: '', relation: 'contractor', category: '' })
  const [busy, setBusy] = useState(false)
  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      onAdded(await api.post('/api/meta/orgs', f))
      setF({ name: '', domain: '', relation: f.relation, category: '' })
      toast('Компания добавлена, люди из неё отмечены', 'success')
    } catch (x) { toast(x.message, 'error') } finally { setBusy(false) }
  }
  return (
    <form className="card card-pad" style={{ marginTop: 22 }} onSubmit={add}>
      <div style={{ fontWeight: 650, marginBottom: 10 }}>Добавить компанию вручную</div>
      <div className="row wrap" style={{ gap: 8 }}>
        <input className="input" style={{ flex: '2 1 180px' }} placeholder="Название (как в Apollo/LinkedIn)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" style={{ flex: '1 1 140px' }} placeholder="сайт.com" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
        <select className="input" style={{ width: 'auto' }} value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>
          <option value="contractor">Подрядчик</option>
          <option value="partner">Партнёр</option>
        </select>
        <input className="input" style={{ flex: '2 1 180px' }} placeholder="Чем занимается (необязательно)" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <button className="btn btn-primary" disabled={busy || f.name.trim().length < 2}><Plus size={14} /> Добавить</button>
      </div>
    </form>
  )
}
