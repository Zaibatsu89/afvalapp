import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type TargetProfile } from '../db'
import { setSetting } from '../lib/actions'
import { download, exportCsv, exportJson, importJson } from '../lib/backup'
import { formatTime, parseTime } from '../lib/day'
import { DEFAULT_MODEL } from '../lib/gemini'
import { DEFAULT_DAY_START, useSetting } from '../lib/hooks'
import { kcalFromMacros } from '../lib/nutrition'

export default function Settings() {
  const dayStart = useSetting<number>('dayStart', DEFAULT_DAY_START)
  const key = useSetting<string>('geminiKey', '')
  const model = useSetting<string>('geminiModel', DEFAULT_MODEL)
  const bottle = useSetting<number>('bottleMl', 500)
  const goal = useSetting<number>('waterGoalMl', 3000)
  const profile = useLiveQuery(() => db.profiles.orderBy('id').first(), [])
  const [msg, setMsg] = useState('')

  return (
    <div className="screen">
      <header><h1>Instellingen</h1></header>

      <h2>Mijn dag begint om</h2>
      <input type="time" value={formatTime(dayStart)} onChange={(e) => e.target.value && setSetting('dayStart', parseTime(e.target.value))} />
      <small>Wat je vóór dit tijdstip eet, telt nog mee voor de vorige dag.</small>

      <h2>Dagdoel</h2>
      {profile && <ProfileEditor p={profile} />}

      <h2>Water</h2>
      <div className="row">
        <label className="field small"><span>Fles (ml)</span><input inputMode="numeric" value={bottle} onChange={(e) => setSetting('bottleMl', Number(e.target.value) || 0)} /></label>
        <label className="field small"><span>Dagdoel (ml)</span><input inputMode="numeric" value={goal} onChange={(e) => setSetting('waterGoalMl', Number(e.target.value) || 0)} /></label>
      </div>

      <h2>Gemini (foto’s lezen)</h2>
      <input type="password" placeholder="API-sleutel" value={key} onChange={(e) => setSetting('geminiKey', e.target.value)} />
      <input placeholder="Model" value={model} onChange={(e) => setSetting('geminiModel', e.target.value)} />
      <small>De sleutel blijft alleen op dit toestel. Gemini leest alleen af wat er staat; je controleert altijd zelf.</small>

      <h2>Back-up</h2>
      <div className="row">
        <button onClick={async () => download('afvalapp-backup.json', await exportJson(), 'application/json')}>Back-up opslaan</button>
        <button onClick={async () => download('afvalapp-dagboek.csv', await exportCsv(), 'text/csv')}>Exporteer CSV</button>
        <label className="btn">
          Terugzetten
          <input type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (!confirm('Alle huidige gegevens worden vervangen door de back-up. Doorgaan?')) return
            try { await importJson(await f.text()); setMsg('Teruggezet ✓') } catch (err) { setMsg((err as Error).message) }
          }} />
        </label>
      </div>
      {msg && <div className="warn">{msg}</div>}
    </div>
  )
}

function ProfileEditor({ p }: { p: TargetProfile }) {
  const t = p.targets
  const upd = (patch: Partial<TargetProfile['targets']>, auto = false) => {
    const next = { ...t, ...patch }
    if (auto) next.kcal = kcalFromMacros(next)
    db.profiles.update(p.id!, { targets: next })
  }
  const num = (k: 'kcal' | 'protein' | 'carbs' | 'fat', label: string, auto: boolean) => (
    <label className="field small">
      <span>{label}</span>
      <input inputMode="numeric" value={t[k]} onChange={(e) => upd({ [k]: Number(e.target.value) || 0 }, auto)} />
    </label>
  )
  return (
    <div className="profile">
      <div className="row">
        {num('kcal', 'kcal', false)}{num('protein', 'eiwit', true)}{num('carbs', 'koolh.', true)}{num('fat', 'vet', true)}
      </div>
    </div>
  )
}
