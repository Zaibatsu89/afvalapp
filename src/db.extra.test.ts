import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AfvalDB, MEALS, MEAL_LABELS, db } from './db'

const macros = { kcal: 100, protein: 1, carbs: 1, fat: 1 }
const opened: AfvalDB[] = []
const fresh = () => {
  const d = new AfvalDB(`extra-${Math.random()}`)
  opened.push(d)
  return d
}

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await d.delete()
  }
})

describe('constanten', () => {
  it('MEALS bevat elke maaltijd precies één keer, met een label', () => {
    expect(new Set(MEALS).size).toBe(MEALS.length)
    expect(MEALS.map((m) => MEAL_LABELS[m])).toEqual(['Eerste Maaltijd', 'Avondeten', 'Restjes', 'Tussendoor'])
  })

  it('de exporteerde instantie heet afvalapp', () => {
    expect(db.name).toBe('afvalapp')
  })
})

describe('schema', () => {
  it('heeft na openen de zeven tabellen', async () => {
    const d = fresh()
    await d.open()
    expect(d.tables.map((t) => t.name).sort()).toEqual(['dayProfiles', 'entries', 'foods', 'profiles', 'settings', 'water', 'weights'])
  })

  it('zoekt entries op dag en op batchId', async () => {
    const d = fresh()
    await d.entries.bulkAdd([
      { foodId: 1, name: 'Kaas', per100: macros, grams: 30, dayKey: '2024-01-01', meal: 'eerste', createdAt: 0, batchId: 'b1' },
      { foodId: 1, name: 'Kaas', per100: macros, grams: 30, dayKey: '2024-01-02', meal: 'eerste', createdAt: 0 },
    ])
    expect(await d.entries.where('dayKey').equals('2024-01-01').count()).toBe(1)
    expect(await d.entries.where('batchId').equals('b1').count()).toBe(1)
  })

  it('dayProfiles en weights gebruiken dayKey als sleutel en overschrijven', async () => {
    const d = fresh()
    await d.dayProfiles.put({ dayKey: '2024-01-01', profileId: 1 })
    await d.dayProfiles.put({ dayKey: '2024-01-01', profileId: 2 })
    await d.weights.put({ dayKey: '2024-01-01', kg: 80 })
    expect(await d.dayProfiles.count()).toBe(1)
    expect((await d.dayProfiles.get('2024-01-01'))?.profileId).toBe(2)
    expect(await d.weights.get('2024-01-01')).toEqual({ dayKey: '2024-01-01', kg: 80 })
  })
})

describe('migratie van een oude database (v1)', () => {
  it('zet oude maaltijdnamen om, vult pinned in en houdt één profiel met naam Dagdoel', async () => {
    const name = `legacy-${Math.random()}`
    const old = new Dexie(name)
    old.version(1).stores({
      foods: '++id, name, favorite, lastUsed, useCount',
      entries: '++id, dayKey, foodId',
      profiles: '++id',
    })
    await old.open()
    await old.table('foods').add({ name: 'Kaas', per100: macros, defaultGrams: 30, favorite: false, useCount: 0, lastUsed: 0 })
    await old.table('entries').add({ foodId: 1, name: 'Kaas', per100: macros, grams: 30, dayKey: '2024-01-01', meal: 'diner', createdAt: 0 })
    await old.table('profiles').bulkAdd([{ name: 'Oud', targets: macros }, { name: 'Nieuwer', targets: macros }])
    old.close()

    const d = new AfvalDB(name)
    opened.push(d)
    await d.open()
    expect((await d.entries.toArray())[0]?.meal).toBe('avondeten')
    expect((await d.foods.toArray())[0]?.pinned).toEqual([])
    expect((await d.profiles.toArray()).map((p) => p.name)).toEqual(['Dagdoel'])
    await new Dexie(name).delete()
  })
})
