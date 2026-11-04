import { useEffect, useRef, useState } from 'react'
import { Check, Globe, MapPin } from 'lucide-react'

/* Regions Apollo understands (countries, continents, EMEA/APAC...); checked against its people search. */
export const REGION_GROUPS = [
  ['Америка', [['North America', 'Северная Америка'], ['United States', 'США'], ['Canada', 'Канада'],
    ['Latin America', 'Латинская Америка'], ['Brazil', 'Бразилия'], ['Mexico', 'Мексика']]],
  ['Европа', [['Europe', 'Вся Европа'], ['United Kingdom', 'Великобритания'], ['Ireland', 'Ирландия'],
    ['Germany', 'Германия'], ['Spain', 'Испания'], ['Portugal', 'Португалия'], ['Poland', 'Польша'], ['Ukraine', 'Украина']]],
  ['Азия и Ближний Восток', [['Asia', 'Вся Азия'], ['India', 'Индия'], ['Philippines', 'Филиппины'], ['Singapore', 'Сингапур'],
    ['Malaysia', 'Малайзия'], ['Middle East', 'Ближний Восток'], ['United Arab Emirates', 'ОАЭ'], ['Israel', 'Израиль'],
    ['Turkey', 'Турция'], ['Kazakhstan', 'Казахстан']]],
  ['Африка и Океания', [['Africa', 'Африка'], ['Kenya', 'Кения'], ['Morocco', 'Марокко'], ['Oceania', 'Австралия и Океания']]],
]
const RU = Object.fromEntries(REGION_GROUPS.flatMap(([, xs]) => xs))
RU.USA = 'США'
export const regionLabel = (v) => (v || '').split(', ').map((x) => RU[x] || x).join(', ')

export function regionChip(region, locations) {
  if (locations?.length) return `📍 ${locations.map((x) => RU[x] || x).join(', ')}`
  if (region === 'world') return '🌍 Весь мир'
  if (region === 'us') return '📍 США'
  return '📍 Регион: авто'
}

/* The region of a search: auto (USA; Meta and unban searches — the whole world), the whole world, or a set of
   countries / regions / cities. */
export function RegionPicker({ region, locations, onChange }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  const toggle = (v) => {
    const next = locations.includes(v) ? locations.filter((x) => x !== v) : [...locations, v]
    onChange({ region: next.length ? 'list' : 'auto', locations: next })
  }
  const addCustom = () => {
    const v = custom.trim()
    if (v && !locations.includes(v)) onChange({ region: 'list', locations: [...locations, v] })
    setCustom('')
  }
  const active = locations.length > 0 || region !== 'auto'
  return (
    <div className="region-picker" ref={ref}>
      <button className={`chip ${active ? 'on' : ''}`} onClick={() => setOpen((x) => !x)} title="Где искать людей">
        <span className="region-chip-text">{regionChip(region, locations)}</span>
      </button>
      {open && (
        <div className="card region-pop">
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={`chip ${region === 'auto' && !locations.length ? 'on' : ''}`} onClick={() => onChange({ region: 'auto', locations: [] })}>
              <MapPin size={13} /> Авто
            </button>
            <button className={`chip ${region === 'world' && !locations.length ? 'on' : ''}`} onClick={() => onChange({ region: 'world', locations: [] })}>
              <Globe size={13} /> Весь мир
            </button>
          </div>
          <div className="small faint" style={{ margin: '6px 0 4px' }}>Авто: США, а для Meta и разбана — весь мир. Можно выбрать несколько регионов.</div>
          {REGION_GROUPS.map(([group, items]) => (
            <div key={group} style={{ marginTop: 8 }}>
              <div className="label">{group}</div>
              <div className="row wrap" style={{ gap: 5 }}>
                {items.map(([v, l]) => (
                  <button key={v} className={`chip ${locations.includes(v) ? 'on' : ''}`} onClick={() => toggle(v)}>
                    {locations.includes(v) && <Check size={12} />} {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="row" style={{ marginTop: 10, gap: 6 }}>
            <input className="input" style={{ height: 32 }} placeholder="Другой: страна, штат или город по-английски"
              value={custom} onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} />
            <button className="btn btn-sm" onClick={addCustom} disabled={!custom.trim()}>Добавить</button>
          </div>
          {locations.filter((x) => !RU[x]).length > 0 && (
            <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
              {locations.filter((x) => !RU[x]).map((x) => (
                <button key={x} className="chip on" onClick={() => toggle(x)} title="Убрать">{x} ×</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
