import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { useTodayKey } from '../lib/hooks'

export default function Weight() {
  const today = useTodayKey()
  const logs = useLiveQuery(() => db.weights.orderBy('dayKey').toArray(), []) ?? []
  const [kg, setKg] = useState('')
  const n = Number(kg.replace(',', '.'))

  const W = 320, H = 160, P = 24
  const vals = logs.map((l) => l.kg)
  const min = Math.min(...vals, Infinity), max = Math.max(...vals, -Infinity)
  const span = Math.max(max - min, 1)
  const pts = logs.map((l, i) => {
    const x = P + (logs.length > 1 ? (i / (logs.length - 1)) * (W - 2 * P) : (W - 2 * P) / 2)
    const y = H - P - ((l.kg - min) / span) * (H - 2 * P)
    return [x, y] as const
  })

  return (
    <div className="screen">
      <header><h1>Gewicht</h1></header>
      <div className="row">
        <input className="big" inputMode="decimal" placeholder="kg" value={kg} onChange={(e) => setKg(e.target.value)} />
        <button className="primary" disabled={!(n > 20 && n < 400)} onClick={async () => { await db.weights.put({ dayKey: today, kg: n }); setKg('') }}>Opslaan</button>
      </div>
      {logs.length > 0 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Gewichtsverloop">
            <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.map((p) => p.join(',')).join(' ')} />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />)}
            <text x={P} y={12} fontSize="10">{max} kg</text>
            <text x={P} y={H - 6} fontSize="10">{min} kg</text>
          </svg>
          <ul className="weights">
            {[...logs].reverse().slice(0, 30).map((l) => (
              <li key={l.dayKey}><span>{l.dayKey}</span><b>{l.kg} kg</b><button className="icon" onClick={() => db.weights.delete(l.dayKey)}>✕</button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
