import { useMemo, useState } from 'react'
import { Link2, Loader2, Search } from 'lucide-react'
import { api, COST_PER_PERSON, plural } from '../api'
import { useApp } from '../App'
import { mergeInto, PersonCard, PersonDrawer, useEnrich, useLivePeople } from '../people'

const LINK_RE = /linkedin\.com\/(?:mwlite\/)?in\/[^/?#\s]+/gi

export default function LookupPage() {
  const { toast, confirm, credits, refreshCredits } = useApp()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [people, setPeople] = useState([])
  const [report, setReport] = useState(null)
  const [openId, setOpenId] = useState(null)
  const merge = useMemo(() => mergeInto(setPeople), [])
  const { enrich, busy: enriching } = useEnrich(merge)
  useLivePeople(people, merge)

  const links = useMemo(() => [...new Set((text.match(LINK_RE) || []).map((l) => l.toLowerCase()))], [text])

  const run = async () => {
    setBusy(true)
    try {
      const r = await api.post('/api/lookup', { urls: links.map((l) => `https://www.${l.replace(/^www\./, '')}`) })
      setPeople((prev) => {
        const ids = new Set(r.people.map((p) => p.apollo_id))
        return [...r.people, ...prev.filter((p) => !ids.has(p.apollo_id))]
      })
      const cached = r.results.filter((x) => x.status === 'cached').length
      const fresh = r.results.filter((x) => x.status === 'new').length
      const missing = r.results.filter((x) => x.status === 'not_found').length
      setReport({ cached, fresh, missing })
      if (r.errors?.length) toast(r.errors[0], 'error')
      else toast(`Готово: новых ${fresh}, из базы ${cached}${missing ? `, не найдено ${missing}` : ''}`, 'success')
      setText('')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
      refreshCredits(true)
    }
  }

  const submit = () => {
    if (!links.length) return
    const n = links.length
    confirm({
      title: `Найти контакты по ${n} ${plural(n, 'ссылке', 'ссылкам', 'ссылкам')}`,
      body: (
        <div className="col" style={{ gap: 8 }}>
          <div>Люди, которые уже есть в базе с контактами, вернутся бесплатно.</div>
          <div>Для новых: <b>1 кредит</b> + <b>8</b> за мобильный. Максимум — <b className="num">{n * COST_PER_PERSON}</b>.</div>
          {credits?.left != null && <div className="faint">На балансе: <span className="num">{credits.left.toLocaleString('ru-RU')}</span></div>}
        </div>
      ),
      ok: 'Найти контакты',
      onOk: run,
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Контакты по ссылке</h1>
          <p>Вставьте одну или несколько ссылок на профили LinkedIn — Apollo найдёт email, телефоны и данные о человеке. Сам LinkedIn не открывается.</p>
        </div>
      </div>
      <div className="composer">
        <div className="composer-top">
          <Link2 size={20} className="composer-icon" />
          <textarea
            rows={3}
            placeholder={'https://www.linkedin.com/in/username\nможно несколько — по одной на строку'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }}
          />
        </div>
        <div className="composer-bar">
          <span className="small muted">
            {links.length ? `Распознано ссылок: ${links.length}` : text.trim() ? 'Ссылки на профили не распознаны' : 'Ctrl+Enter — найти'}
          </span>
          <div className="grow" />
          <button className="btn btn-primary" disabled={!links.length || busy} onClick={submit}>
            {busy ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Найти контакты
          </button>
        </div>
      </div>

      {report && (
        <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
          <span className="badge badge-green">новых: {report.fresh}</span>
          <span className="badge badge-gray">из базы: {report.cached}</span>
          {report.missing > 0 && <span className="badge badge-red">не найдено в Apollo: {report.missing}</span>}
        </div>
      )}

      {people.length > 0 ? (
        <div className="cards" style={{ marginTop: 18 }}>
          {people.map((p, i) => (
            <PersonCard key={p.apollo_id} p={p} index={i} onOpen={(x) => setOpenId(x.apollo_id)} onEnrich={enrich} busy={enriching.has(p.apollo_id)} />
          ))}
        </div>
      ) : !busy && (
        <div className="empty">
          <Link2 size={36} />
          <h3>Здесь появятся найденные люди</h3>
          <div>Все результаты сохраняются во вкладке «Контакты».</div>
        </div>
      )}
      <PersonDrawer id={openId} onClose={() => setOpenId(null)} onChanged={merge} />
    </div>
  )
}
