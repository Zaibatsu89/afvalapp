import { useState } from 'react'
import { Camera } from './Camera'
import { DEFAULT_MODEL, imageToBase64, readScale, scaleToGrams } from '../lib/gemini'
import { useSetting } from '../lib/hooks'

/** 📷-knop: foto van het weegschaaldisplay → gram. De uitkomst wordt altijd nog bevestigd door de gebruiker. */
export function WeighButton({ onGrams }: { onGrams: (g: number) => void }) {
  const apiKey = useSetting<string>('geminiKey', '')
  const model = useSetting<string>('geminiModel', DEFAULT_MODEL)
  const [cam, setCam] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  async function onFile(file: Blob) {
    setCam(false)
    if (!apiKey) return setMsg('Vul eerst je Gemini-sleutel in bij Instellingen.')
    setBusy(true)
    setMsg('')
    try {
      const g = scaleToGrams(await readScale(apiKey, model, await imageToBase64(file)))
      if (g == null) setMsg('Kon het getal niet lezen. Probeer opnieuw of typ het in.')
      else setPending(g)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setCam(true)} disabled={busy}>
        {busy ? 'Lezen…' : '📷 Weeg'}
      </button>
      {cam && <Camera onShot={onFile} onClose={() => setCam(false)} />}
      {msg && <div className="warn">{msg}</div>}
      {pending != null && (
        <div className="modal">
          <div className="card">
            <p>Weegschaal zegt</p>
            <input className="big" type="number" inputMode="decimal" value={pending} onChange={(e) => setPending(Number(e.target.value))} />
            <p>gram</p>
            <div className="row">
              <button className="primary" onClick={() => { onGrams(pending); setPending(null) }}>Klopt</button>
              <button onClick={() => setPending(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
