import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useMemo, useState } from 'react'
import { db, MEALS, MEAL_LABELS, type Food, type Meal } from '../db'
import { addFoodToDay, togglePinned, undoEntries } from '../lib/actions'
import { formatDayLabel } from '../lib/day'
import { scale } from '../lib/nutrition'
import { searchFoods } from '../lib/search'
import { useToast } from '../lib/toast'
import { FoodForm } from './FoodForm'
import { WeighButton } from './WeighButton'

type Filter = 'alles' | 'favorieten'

export default function AddFood({ day, todayKey, meal, setMeal, onBack }: { day: string; todayKey: string; meal: Meal; setMeal: (m: Meal) => void; onBack: () => void }) {
  const toast = useToast()
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? []
  const entries = useLiveQuery(() => db.entries.where('dayKey').equals(day).toArray(), [day]) ?? []
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('alles')
  const [sheet, setSheet] = useState<Food | null>(null)
  const [grams, setGrams] = useState(100)
  const [form, setForm] = useState<Food | 'new' | null>(null)
  const [newName, setNewName] = useState('')

  const counts = useMemo(() => {
    const m = new Map<number, number>()
    for (const e of entries) m.set(e.foodId, (m.get(e.foodId) ?? 0) + 1)
    return m
  }, [entries])

  const list = useMemo(() => {
    return searchFoods(foods, query, filter === 'favorieten', meal)
  }, [foods, query, filter, meal])

  async function add(f: Food, g = f.defaultGrams) {
    const id = await addFoodToDay(f, day, meal, g)
    toast({ text: `${f.name} · ${g} g toegevoegd`, undo: () => undoEntries([id]) })
  }

  return (
    <div className="screen">
      <header>
        <button className="back" onClick={onBack}>← Terug</button>
        <h1>Toevoegen</h1>
        <small>aan {MEAL_LABELS[meal]} · {formatDayLabel(day, todayKey)}</small>
      </header>
      <div className="chips">
        {MEALS.map((m) => (
          <button key={m} className={m === meal ? 'chip on' : 'chip'} onClick={() => setMeal(m)}>{MEAL_LABELS[m]}</button>
        ))}
      </div>
      <input className="search" type="search" placeholder="Zoek product…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips">
        {(['alles', 'favorieten'] as Filter[]).map((f) => (
          <button key={f} className={f === filter ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <button className="chip" onClick={() => { setNewName(''); setForm('new') }}>＋ Nieuw product</button>
      </div>

      <ul className="foods">
        {list.map((f, i) => {
          const n = counts.get(f.id!) ?? 0
          const pin = f.pinned.includes(meal)
          const header = pin && i === 0 ? 'Vast' : !pin && (i === 0 || list[i - 1].pinned.includes(meal)) && list.some((x) => x.pinned.includes(meal)) ? 'Overig' : null
          const m = scale(f.per100, f.defaultGrams)
          return (
            <Fragment key={f.id}>
            {header && <li className="sep">{header}</li>}
            <li className={pin ? 'pinned' : ''}>
              <button className="foodmain" onClick={() => add(f)}>
                <span className="name">{f.name}{n > 0 && <b className="badge">{n}×</b>}</span>
                <small>{f.defaultGrams} g · {m.kcal} kcal · E {m.protein}</small>
              </button>
              <button className="icon" aria-label="Andere hoeveelheid" onClick={() => { setSheet(f); setGrams(f.defaultGrams) }}>g</button>
              <button className="icon" aria-label="Vast in deze categorie" onClick={() => togglePinned(f, meal)}>{pin ? '📌' : '📍'}</button>
              <button className="icon" aria-label="Favoriet" onClick={() => db.foods.update(f.id!, { favorite: !f.favorite })}>{f.favorite ? '★' : '☆'}</button>
              <button className="icon" aria-label="Bewerk" onClick={() => setForm(f)}>✎</button>
            </li>
            </Fragment>
          )
        })}
        {query.trim() && (
          <li className="create">
            <button className="foodmain" onClick={() => { setNewName(query.trim()); setForm('new') }}>
              <span className="name">＋ Maak "{query.trim()}" aan</span>
              <small>{list.length === 0 ? 'Niets gevonden · ' : ''}met foto van het label of handmatig</small>
            </button>
          </li>
        )}
      </ul>

      {sheet && (
        <div className="modal">
          <div className="card">
            <h2>{sheet.name}</h2>
            <div className="row">
              <input className="big" type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(Number(e.target.value))} />
              <span>g</span>
              <WeighButton onGrams={setGrams} />
            </div>
            <p>{scale(sheet.per100, grams).kcal} kcal</p>
            <div className="row">
              <button className="primary" disabled={!(grams > 0)} onClick={async () => { await add(sheet, grams); setSheet(null) }}>Toevoegen</button>
              <button onClick={() => setSheet(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
      {form && <FoodForm food={form === 'new' ? undefined : form} initialName={form === 'new' ? newName : undefined} onClose={() => setForm(null)} />}
    </div>
  )
}
