import type { Macros } from './nutrition'

export interface LabelResult {
  name: string | null
  /** Per hoeveel gram/ml de tabel is (meestal 100). */
  perAmount: number | null
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

export interface ScaleResult {
  value: number | null
  unit: 'g' | 'kg' | 'oz' | 'lb' | null
}

export const DEFAULT_MODEL = 'gemini-flash-latest'

const LABEL_PROMPT = `Lees de voedingswaardetabel op deze foto af. Neem UITSLUITEND over wat er letterlijk staat; schat of bereken niets.
- kcal: energie in kcal (niet kJ). Staat er alleen kJ, geef dan null.
- protein/carbs/fat: eiwit, koolhydraten, vet in gram, per hoeveelheid 'perAmount' (meestal 100 g of 100 ml). Gebruik de kolom "per 100 g" als die er is.
- Is een waarde onleesbaar of ontbreekt hij: null. Nooit raden.
- name: productnaam alleen als die duidelijk zichtbaar is, anders null.`

const SCALE_PROMPT = `Lees het getal op het display van deze keukenweegschaal af. Geef de waarde en eenheid (g, kg, oz of lb) zoals getoond; staat er geen eenheid, gebruik g. Is het niet duidelijk leesbaar: value null. Nooit schatten hoeveel het weegt.`

const num = { type: 'NUMBER', nullable: true }

const LABEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true },
    perAmount: num,
    kcal: num,
    protein: num,
    carbs: num,
    fat: num,
  },
  required: ['name', 'perAmount', 'kcal', 'protein', 'carbs', 'fat'],
}

const SCALE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    value: num,
    unit: { type: 'STRING', nullable: true, enum: ['g', 'kg', 'oz', 'lb'] },
  },
  required: ['value', 'unit'],
}

/** Verklein foto (lange zijde max 1600px) en geef base64 JPEG terug. */
export async function imageToBase64(file: Blob, maxSide = 1600): Promise<string> {
  const bmp = await createImageBitmap(file)
  const f = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * f)
  canvas.height = Math.round(bmp.height * f)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg', 0.85)
  return url.slice(url.indexOf(',') + 1)
}

async function ask<T>(apiKey: string, model: string, prompt: string, schema: object, imageB64: string): Promise<T> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageB64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema },
    }),
  })
  if (!res.ok) {
    if (res.status === 429) throw new Error('De gratis limiet van Gemini is voor nu bereikt. Probeer het over een poosje opnieuw of vul de waarden zelf in.')
    if (res.status === 400 || res.status === 403) throw new Error('Gemini weigert de sleutel. Controleer de sleutel bij Instellingen.')
    if (res.status === 404) throw new Error('Dit Gemini-model bestaat niet (meer). Kies een ander model bij Instellingen.')
    throw new Error(`Gemini fout ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const json = await res.json()
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini gaf geen antwoord')
  return JSON.parse(text) as T
}

export const readLabel = (key: string, model: string, img: string) =>
  ask<LabelResult>(key, model, LABEL_PROMPT, LABEL_SCHEMA, img)

export const readScale = (key: string, model: string, img: string) =>
  ask<ScaleResult>(key, model, SCALE_PROMPT, SCALE_SCHEMA, img)

/** Tabel naar per-100 omrekenen (als de tabel per portie/andere hoeveelheid is). Null-velden blijven null. */
export function labelToPer100(r: LabelResult): { [K in keyof Macros]: number | null } {
  const f = r.perAmount && r.perAmount > 0 ? 100 / r.perAmount : 1
  const c = (v: number | null) => (v == null ? null : Math.round(v * f * 10) / 10)
  return { kcal: r.kcal == null ? null : Math.round(r.kcal * f), protein: c(r.protein), carbs: c(r.carbs), fat: c(r.fat) }
}

export function scaleToGrams(r: ScaleResult): number | null {
  if (r.value == null) return null
  const mult = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 }[r.unit ?? 'g']
  return Math.round(r.value * mult * 10) / 10
}
