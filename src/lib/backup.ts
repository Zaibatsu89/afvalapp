import { db } from '../db'

export async function exportJson(): Promise<string> {
  const [foods, entries, profiles, dayProfiles, weights, settings, water] = await Promise.all([
    db.foods.toArray(), db.entries.toArray(), db.profiles.toArray(), db.dayProfiles.toArray(), db.weights.toArray(), db.settings.toArray(), db.water.toArray(),
  ])
  // API-sleutel hoort niet in een back-upbestand.
  return JSON.stringify({ v: 1, water, foods, entries, profiles, dayProfiles, weights, settings: settings.filter((s) => s.key !== 'geminiKey') })
}

export async function importJson(text: string) {
  const d = JSON.parse(text)
  if (d?.v !== 1 || !Array.isArray(d.foods) || !Array.isArray(d.entries)) throw new Error('Geen geldig back-upbestand')
  await db.transaction('rw', [db.foods, db.entries, db.profiles, db.dayProfiles, db.weights, db.settings, db.water], async () => {
    await Promise.all([db.foods.clear(), db.entries.clear(), db.profiles.clear(), db.dayProfiles.clear(), db.weights.clear(), db.water.clear()])
    const mealMap: Record<string, string> = { ontbijt: 'eerste', lunch: 'eerste', diner: 'avondeten' }
    await db.foods.bulkPut(d.foods.map((f: object) => ({ pinned: [], ...f })))
    await db.entries.bulkPut(d.entries.map((e: { meal: string }) => ({ ...e, meal: mealMap[e.meal] ?? e.meal })))
    await db.water.bulkPut(d.water ?? [])
    await db.profiles.bulkPut(d.profiles ?? [])
    await db.dayProfiles.bulkPut(d.dayProfiles ?? [])
    await db.weights.bulkPut(d.weights ?? [])
    await db.settings.bulkPut(d.settings ?? [])
  })
}

export async function exportCsv(): Promise<string> {
  const rows = await db.entries.orderBy('dayKey').toArray()
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const head = 'dag,maaltijd,product,gram,kcal,eiwit,koolhydraten,vet'
  return [head, ...rows.map((e) => {
    const f = e.grams / 100
    return [e.dayKey, e.meal, esc(e.name), e.grams, Math.round(e.per100.kcal * f), +(e.per100.protein * f).toFixed(1), +(e.per100.carbs * f).toFixed(1), +(e.per100.fat * f).toFixed(1)].join(',')
  })].join('\n')
}

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
