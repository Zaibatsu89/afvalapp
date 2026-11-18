import { useState } from 'react'
import { Camera } from './Camera'
import { db, type Food } from '../db'
import { DEFAULT_MODEL, imageToBase64, labelToPer100, readLabel } from '../lib/gemini'
import { useSetting } from '../lib/hooks'
import { kcalLooksWrong } from '../lib/nutrition'

type Fields = { name: string; kcal: string; protein: string; carbs: string; fat: string; grams: string }
const str = (n: number | null | undefined) => (n == null ? '' : String(n))

export function FoodForm({ food, initialName, onClose }: { food?: Food; initialName?: string; onClose: () => void }) {
  const apiKey = useSetting<string>('geminiKey', '')
  const model = useSetting<string>('geminiModel', DEFAULT_MODEL)
  const [cam, setCam] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [unread, setUnread] = useState<Set<string>>(new Set())
  const [f, setF] = useState<Fields>({
    name: food?.name ?? initialName ?? '',
    kcal: str(food?.per100.kcal),
    protein: str(food?.per100.protein),
    carbs: str(food?.per100.carbs),
    fat: str(food?.per100.fat),
    grams: str(food?.defaultGrams ?? 100),
  })
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value })
    if (unread.has(k)) setUnread(new Set([...unread].filter((x) => x !== k)))
  }

  async function onPhoto(file: Blob) {
    setCam(false)
    if (!apiKey) return setMsg('Vul eerst je Gemini-sleutel in bij Instellingen.')
    setBusy(true)
    setMsg('')
    try {
      const r = await readLabel(apiKey, model, await imageToBase64(file))
      const p = labelToPer100(r)
      setF({ ...f, name: f.name || r.name || '', kcal: str(p.kcal), protein: str(p.protein), carbs: str(p.carbs), fat: str(p.fat) })
      setUnread(new Set((['kcal', 'protein', 'carbs', 'fat'] as const).filter((k) => p[k] == null)))
      setMsg('Uitgelezen. Controleer de waarden met het label.')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const n = (s: string) => Number(s.replace(',', '.')) || 0
  const per100 = { kcal: n(f.kcal), protein: n(f.protein), carbs: n(f.carbs), fat: n(f.fat) }
  const suspicious = f.kcal !== '' && kcalLooksWrong(per100)
  const valid = f.name.trim() !== '' && f.kcal !== ''

  async function save() {
    const data = { name: f.name.trim(), per100, defaultGrams: n(f.grams) || 100 }
    if (food) await db.foods.update(food.id!, data)
    else await db.foods.add({ ...data, favorite: false, pinned: [], useCount: 0, lastUsed: 0 })
    onClose()
  }

  const field = (k: keyof Fields, label: string, unit = 'g') => (
    <label className={unread.has(k) ? 'field unread' : 'field'}>
      <span>{label} per 100 {unit === 'kcal' ? 'g' : 'g'}</span>
      <input inputMode="decimal" value={f[k]} onChange={set(k)} placeholder={unread.has(k) ? 'niet gelezen' : ''} />
    </label>
  )

  return (
    <div className="modal">
      <div className="card tall">
        <h2>{food ? 'Product bewerken' : 'Nieuw product'}</h2>
        <button className="primary wide" onClick={() => setCam(true)} disabled={busy}>
          {busy ? 'Label lezen…' : '📷 Foto van voedingswaarde'}
        </button>
        {cam && <Camera onShot={onPhoto} onClose={() => setCam(false)} />}
        {msg && <div className="warn">{msg}</div>}
        <label className="field"><span>Naam</span><input value={f.name} onChange={set('name')} /></label>
        {field('kcal', 'Calorieën (kcal)', 'kcal')}
        {field('protein', 'Eiwit (g)')}
        {field('carbs', 'Koolhydraten (g)')}
        {field('fat', 'Vet (g)')}
        {suspicious && <div className="warn">De calorieën passen niet bij eiwit/koolhydraten/vet. Controleer het label.</div>}
        <label className="field"><span>Standaard hoeveelheid (g)</span><input inputMode="decimal" value={f.grams} onChange={set('grams')} /></label>
        <div className="row">
          <button className="primary" disabled={!valid} onClick={save}>Opslaan</button>
          <button onClick={onClose}>Annuleren</button>
          {food && <button className="danger" onClick={async () => { await db.foods.delete(food.id!); onClose() }}>Verwijder</button>}
        </div>
      </div>
    </div>
  )
}
