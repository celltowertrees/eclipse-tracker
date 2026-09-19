import { useMemo, useState } from 'react'
import { KIND_LABEL } from '../lib/format'
import { useStore } from '../store'

export default function EclipseSelect() {
  const catalog = useStore((s) => s.catalog)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const [kinds, setKinds] = useState({ T: true, A: true, H: true })

  const list = useMemo(() => (catalog?.eclipses ?? []).filter((e) => kinds[e.kind] || e.id === selected?.id), [catalog, kinds, selected])
  const byDecade = useMemo(() => {
    const groups = new Map<string, typeof list>()
    for (const e of list) {
      const decade = `${e.id.slice(0, 3)}0s`
      groups.set(decade, [...(groups.get(decade) ?? []), e])
    }
    return [...groups]
  }, [list])

  const idx = list.findIndex((e) => e.id === selected?.id)
  const step = (d: number) => {
    const next = list[idx + d]
    if (next) void select(next.id)
  }

  return (
    <div className="picker">
      <label className="picker__label" htmlFor="eclipse-select">
        Eclipse
      </label>
      <div className="picker__row">
        <button className="btn btn--icon" onClick={() => step(-1)} disabled={idx <= 0} aria-label="Previous eclipse">
          ‹
        </button>
        <select id="eclipse-select" className="select" value={selected?.id ?? ''} onChange={(ev) => void select(ev.target.value)}>
          {byDecade.map(([decade, items]) => (
            <optgroup key={decade} label={decade}>
              {items.map((e) => (
                <option key={e.id} value={e.id}>
                  {new Date(`${e.id}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}
                  {' — '}
                  {KIND_LABEL[e.kind]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="btn btn--icon" onClick={() => step(1)} disabled={idx < 0 || idx >= list.length - 1} aria-label="Next eclipse">
          ›
        </button>
      </div>
      <div className="picker__filters" role="group" aria-label="Filter by type">
        {(['T', 'A', 'H'] as const).map((k) => (
          <label key={k} className={`chip chip--${k}`}>
            <input type="checkbox" checked={kinds[k]} onChange={(ev) => setKinds({ ...kinds, [k]: ev.target.checked })} />
            {KIND_LABEL[k]}
          </label>
        ))}
      </div>
    </div>
  )
}
