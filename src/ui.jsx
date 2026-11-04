import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Minus, Plus, X } from 'lucide-react'
import { initials } from './api'

/* ---------------------------------------------------------------- toasts */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, kind = 'info') => {
    const id = Math.random()
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])
  const Icon = { error: AlertTriangle, success: CheckCircle2, info: Info }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => {
          const I = Icon[t.kind]
          return (
            <div key={t.id} className={`toast ${t.kind}`}>
              <I size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{t.text}</div>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------------------------------------------------------- tag input */
export function TagInput({ value, onChange, placeholder, suggestions }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const add = (raw) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    const next = [...value]
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    onChange(next)
    setText('')
  }
  return (
    <div>
      <div className="tag-input" onClick={() => ref.current?.focus()}>
        {value.map((v) => (
          <span key={v} className="tag">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label="Удалить"><X size={12} /></button>
          </span>
        ))}
        <input
          ref={ref}
          value={text}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => {
            if (/[,;]/.test(e.target.value)) add(e.target.value)
            else setText(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) { e.preventDefault(); add(text) }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => text.trim() && add(text)}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text')
            if (/[,;\n]/.test(t)) { e.preventDefault(); add(t) }
          }}
        />
      </div>
      {suggestions?.length > 0 && (
        <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <button key={s} type="button" className="chip" onClick={() => onChange([...value, s])}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- small pieces */
export function Switch({ checked, onChange, children }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
      {children}
    </label>
  )
}

export function Stepper({ value, onChange, min = 1, max = 100 }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, Number(v) || min)))
  return (
    <div className="stepper">
      <button type="button" onClick={() => set(value - 1)} aria-label="Меньше"><Minus size={14} /></button>
      <input className="num" value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} />
      <button type="button" onClick={() => set(value + 1)} aria-label="Больше"><Plus size={14} /></button>
    </div>
  )
}

export function Avatar({ person, size }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`avatar ${size === 'sm' ? 'sm' : ''}`}>
      {person.photo_url && !broken
        ? <img src={person.photo_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : initials(person)}
    </div>
  )
}

export function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={`btn btn-ghost icon-btn copy ${done ? 'copied' : ''}`}
      title="Скопировать"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) })
      }}
    >
      {done ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
    </button>
  )
}

export function ScoreBadge({ score }) {
  if (score === null || score === undefined) return null
  const cls = score >= 75 ? 'badge-green' : score >= 45 ? 'badge-amber' : 'badge-red'
  return <span className={`badge ${cls} num`} title="Релевантность по оценке ИИ">{score}%</span>
}

export function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" role="dialog">{children}</div>
    </>
  )
}

export function Confirm({ state, onClose }) {
  if (!state) return null
  return (
    <Modal open onClose={onClose}>
      <h3>{state.title}</h3>
      <div className="muted">{state.body}</div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" autoFocus onClick={() => { onClose(); state.onOk() }}>{state.ok || 'Подтвердить'}</button>
      </div>
    </Modal>
  )
}
