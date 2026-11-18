import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, MEALS, MEAL_LABELS, type Entry, type Meal } from '../db'
import { formatDayLabel, formatTime, shiftDay } from '../lib/day'
import { addWater, copyEntries, moveEntryToDay, setEntryGrams, undoEntries, undoWater } from '../lib/actions'
import { scale, sum, type Macros } from '../lib/nutrition'
import { DEFAULT_DAY_START, useSetting } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { WeighButton } from './WeighButton'

const BARS: { k: keyof Macros; label: string; unit: string }[] = [
  { k: 'kcal', label: 'Calorieën', unit: 'kcal' },
  { k: 'protein', label: 'Eiwit', unit: 'g' },
  { k: 'carbs', label: 'Koolhydraten', unit: 'g' },
  { k: 'fat', label: 'Vet', unit: 'g' },
]

interface Props {
  day: string
  setDay: (d: string) => void
  todayKey: string
  goAdd: (meal?: Meal) => void
}

export default function Today({ day, setDay, todayKey, goAdd }: Props) {
  const toast = useToast()
  const dayStart = useSetting<number>('dayStart', DEFAULT_DAY_START)
  const entries = useLiveQuery(() => db.entries.where('dayKey').equals(day).sortBy('createdAt'), [day]) ?? []
  const prevEntries = useLiveQuery(() => db.entries.where('dayKey').equals(shiftDay(day, -1)).toArray(), [day]) ?? []
  const profile = useLiveQuery(() => db.profiles.orderBy('id').first(), [])
  const total = sum(entries.map((e) => scale(e.per100, e.grams)))
  const water = useLiveQuery(() => db.water.where('dayKey').equals(day).toArray(), [day]) ?? []
  const bottleMl = useSetting<number>('bottleMl', 500)
  const waterGoal = useSetting<number>('waterGoalMl', 3000)
  const waterMl = water.reduce((a, w) => a + w.ml, 0)
  const [editing, setEditing] = useState<number | null>(null)
  // Eén token per "Zelfde als gisteren"-knop; na gebruik is de knop uitgeschakeld.
  const [copyToken] = useState(() => crypto.randomUUID())
  const copiedHere = entries.some((e) => e.batchId === `${copyToken}:${day}`)

  async function copyYesterday() {
    const ids = await copyEntries(
      prevEntries.map((e) => e.id!),
      day,
      `${copyToken}:${day}`,
      undefined,
      db,
    )
    toast({ text: `${ids.length} toegevoegd`, undo: () => undoEntries(ids) })
  }

  return (
    <div className="screen">
      <header className="daynav">
        <button onClick={() => setDay(shiftDay(day, -1))} aria-label="Vorige dag">‹</button>
        <div>
          <h1>{formatDayLabel(day, todayKey)}</h1>
          <small>Dag loopt tot {formatTime(dayStart)}</small>
        </div>
        <button onClick={() => setDay(shiftDay(day, 1))} disabled={day >= todayKey} aria-label="Volgende dag">›</button>
      </header>

      <div className="waterbar">
        <span>💧 {(waterMl / 1000).toLocaleString('nl-NL')} / {(waterGoal / 1000).toLocaleString('nl-NL')} L</span>
        <div className="track"><div className="fill water" style={{ width: `${Math.min(100, (waterMl / waterGoal) * 100)}%` }} /></div>
        <button
          onClick={async () => {
            const id = await addWater(bottleMl, day)
            toast({ text: `Fles leeg (${bottleMl} ml)`, undo: () => undoWater(id) })
          }}
        >
          ＋ fles
        </button>
      </div>

      {profile && (
        <div className="bars">
          {BARS.map(({ k, label, unit }) => {
            const target = profile.targets[k]
            const pct = target ? Math.min(100, (total[k] / target) * 100) : 0
            const over = total[k] > target
            return (
              <div key={k} className="bar">
                <div className="barhead">
                  <span>{label}</span>
                  <span className={over ? 'over' : ''}>
                    {total[k]} / {target} {unit}
                  </span>
                </div>
                <div className="track"><div className={over ? 'fill over' : 'fill'} style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}

      {entries.length === 0 && prevEntries.length > 0 && (
        <button className="primary wide" onClick={copyYesterday} disabled={copiedHere}>
          {copiedHere ? 'Toegevoegd ✓' : `Zelfde als dag ervoor (${prevEntries.length})`}
        </button>
      )}

      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal)
        const kcal = sum(items.map((e) => scale(e.per100, e.grams))).kcal
        return (
          <section key={meal} className="mealcard">
            <div className="mealhead">
              <h2>{MEAL_LABELS[meal]}</h2>
              <span className="kcal">{kcal} kcal</span>
              <button className="add" onClick={() => goAdd(meal)} aria-label={`Toevoegen aan ${MEAL_LABELS[meal]}`}>＋</button>
            </div>
            {items.map((e) => (
              <EntryRow key={e.id} e={e} open={editing === e.id} toggle={() => setEditing(editing === e.id ? null : e.id!)} day={day} />
            ))}
          </section>
        )
      })}

    </div>
  )
}

function EntryRow({ e, open, toggle, day }: { e: Entry; open: boolean; toggle: () => void; day: string }) {
  const toast = useToast()
  const m = scale(e.per100, e.grams)
  async function remove() {
    const copy = { ...e }
    await db.entries.delete(e.id!)
    toast({ text: `${e.name} verwijderd`, undo: async () => void (await db.entries.put(copy)) })
  }
  return (
    <div className="entry">
      <button className="entryhead" onClick={toggle}>
        <span>{e.name}</span>
        <span>{e.grams} g · {m.kcal} kcal</span>
      </button>
      {open && (
        <div className="entryedit">
          <div className="macros">E {m.protein} · K {m.carbs} · V {m.fat}</div>
          <div className="row">
            <input type="number" inputMode="decimal" defaultValue={e.grams} onBlur={(ev) => setEntryGrams(e.id!, Number(ev.target.value) || e.grams)} />
            <span>g</span>
            <WeighButton onGrams={(g) => setEntryGrams(e.id!, g)} />
          </div>
          <div className="row">
            <button onClick={() => moveEntryToDay(e.id!, shiftDay(day, -1))}>← Vorige dag</button>
            <button onClick={() => moveEntryToDay(e.id!, shiftDay(day, 1))}>Volgende dag →</button>
            <button className="danger" onClick={remove}>Verwijder</button>
          </div>
        </div>
      )}
    </div>
  )
}
