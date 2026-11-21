import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AfvalDB,
  MEALS,
  MEAL_LABELS,
  type DayProfile,
  type Entry,
  type Food,
  type Meal,
  type Setting,
} from './db'
import type { Macros } from './lib/nutrition'

const M: Macros = { kcal: 100, protein: 10, carbs: 20, fat: 5 }
const TABLES = ['dayProfiles', 'entries', 'foods', 'profiles', 'settings', 'water', 'weights']

const V1_STORES = {
  foods: '++id, name, favorite, lastUsed, useCount',
  entries: '++id, dayKey, foodId, batchId',
  profiles: '++id',
  dayProfiles: 'dayKey',
  weights: 'dayKey',
  settings: 'key',
}

interface V1Food extends Omit<Food, 'pinned'> {
  pinned?: Meal[]
}
interface V1Entry extends Omit<Entry, 'meal'> {
  meal: string
}
interface OldProfile {
  id?: number
  name: string
  targets: Macros
}

let n = 0
const nextName = () => `dbtest-${n++}`
const opened: Dexie[] = []
const track = <T extends Dexie>(d: T): T => {
  opened.push(d)
  return d
}
const fresh = (): AfvalDB => track(new AfvalDB(nextName()))

afterEach(async () => {
  const names = new Set(opened.map((d) => d.name))
  for (const d of opened) d.close()
  opened.length = 0
  await Promise.all([...names].map((name) => Dexie.delete(name)))
})

async function seedV1(name: string, fill?: (d: Dexie) => Promise<void>) {
  const seed = track(new Dexie(name))
  seed.version(1).stores(V1_STORES)
  await seed.open()
  if (fill) await fill(seed)
  seed.close()
}

async function seedV2(name: string, fill?: (d: Dexie) => Promise<void>) {
  const seed = track(new Dexie(name))
  seed.version(1).stores(V1_STORES)
  seed.version(2).stores({ water: '++id, dayKey' })
  await seed.open()
  if (fill) await fill(seed)
  seed.close()
}

async function migrate(name: string): Promise<AfvalDB> {
  const db = track(new AfvalDB(name))
  await db.open()
  expect(db.verno).toBe(3)
  return db
}

const v3Entry = (over: Partial<Omit<Entry, 'id'>> = {}): Omit<Entry, 'id'> => ({
  foodId: 1,
  name: 'Appel',
  per100: M,
  grams: 100,
  dayKey: '2026-11-19',
  meal: 'eerste',
  createdAt: 1000,
  ...over,
})

const v3Food = (over: Partial<Omit<Food, 'id'>> = {}): Omit<Food, 'id'> => ({
  name: 'Appel',
  per100: M,
  defaultGrams: 100,
  favorite: false,
  pinned: [],
  useCount: 0,
  lastUsed: 0,
  ...over,
})

const v1Entry = (over: Partial<V1Entry> = {}): V1Entry => ({
  foodId: 1,
  name: 'Appel',
  per100: M,
  grams: 100,
  dayKey: '2026-11-19',
  meal: 'eerste',
  createdAt: 1000,
  ...over,
})

const v1Food = (over: Partial<V1Food> = {}): V1Food => ({
  name: 'Appel',
  per100: M,
  defaultGrams: 100,
  favorite: false,
  useCount: 0,
  lastUsed: 0,
  ...over,
})

const targets = (kcal: number): Macros => ({ ...M, kcal })

function inspectStores(db: Dexie) {
  const tx = db.backendDB().transaction(TABLES, 'readonly')
  return Object.fromEntries(
    TABLES.map((t) => {
      const s = tx.objectStore(t)
      return [
        t,
        {
          keyPath: s.keyPath,
          autoIncrement: s.autoIncrement,
          indexes: Array.from(s.indexNames).sort(),
        },
      ]
    }),
  )
}

describe('constanten', () => {
  it('MEALS bevat precies de vier maaltijden in vaste volgorde', () => {
    expect([...MEALS]).toEqual(['eerste', 'avondeten', 'restjes', 'tussendoor'])
  })

  it('MEAL_LABELS heeft exact dezelfde sleutels als MEALS en geen lege labels', () => {
    expect(Object.keys(MEAL_LABELS).sort()).toEqual([...MEALS].sort())
    for (const m of MEALS) expect(MEAL_LABELS[m].trim().length).toBeGreaterThan(0)
  })
})

describe('schema (verse DB)', () => {
  it('gebruikt standaard de naam afvalapp (zonder te openen)', () => {
    expect(new AfvalDB().name).toBe('afvalapp')
  })

  it('maakt versie 3 met exact de 7 object stores', async () => {
    const db = fresh()
    await db.open()
    expect(db.verno).toBe(3)
    expect(db.tables.map((t) => t.name).sort()).toEqual(TABLES)
    expect(Array.from(db.backendDB().objectStoreNames).sort()).toEqual(TABLES)
  })

  it('heeft de verwachte sleutels, autoIncrement en indexen per store', async () => {
    const db = fresh()
    await db.open()
    expect(inspectStores(db)).toEqual({
      foods: { keyPath: 'id', autoIncrement: true, indexes: ['favorite', 'lastUsed', 'name', 'useCount'] },
      entries: { keyPath: 'id', autoIncrement: true, indexes: ['batchId', 'dayKey', 'foodId'] },
      profiles: { keyPath: 'id', autoIncrement: true, indexes: [] },
      water: { keyPath: 'id', autoIncrement: true, indexes: ['dayKey'] },
      dayProfiles: { keyPath: 'dayKey', autoIncrement: false, indexes: [] },
      weights: { keyPath: 'dayKey', autoIncrement: false, indexes: [] },
      settings: { keyPath: 'key', autoIncrement: false, indexes: [] },
    })
  })
})

describe('sleutels en constraints', () => {
  it('auto-increment tabellen geven numerieke oplopende ids', async () => {
    const db = fresh()
    const a = await db.foods.add(v3Food({ name: 'a' }))
    const b = await db.foods.add(v3Food({ name: 'b' }))
    expect(typeof a).toBe('number')
    expect(typeof b).toBe('number')
    expect(Number(b)).toBeGreaterThan(Number(a))
    expect(await db.foods.get(a)).toEqual({ ...v3Food({ name: 'a' }), id: a })

    expect(typeof (await db.entries.add(v3Entry()))).toBe('number')
    expect(typeof (await db.profiles.add({ name: 'x', targets: M }))).toBe('number')
    expect(typeof (await db.water.add({ dayKey: 'a', ml: 250, createdAt: 1 }))).toBe('number')
  })

  it('put overschrijft bestaande records zonder duplicaat', async () => {
    const db = fresh()
    await db.settings.put({ key: 'k', value: 1 })
    await db.settings.put({ key: 'k', value: 2 })
    await db.weights.put({ dayKey: '2026-01-01', kg: 80 })
    await db.weights.put({ dayKey: '2026-01-01', kg: 79 })
    await db.dayProfiles.put({ dayKey: '2026-01-01', profileId: 1 })
    await db.dayProfiles.put({ dayKey: '2026-01-01', profileId: 2 })
    expect(await db.settings.toArray()).toEqual([{ key: 'k', value: 2 }])
    expect(await db.weights.toArray()).toEqual([{ dayKey: '2026-01-01', kg: 79 }])
    expect(await db.dayProfiles.toArray()).toEqual([{ dayKey: '2026-01-01', profileId: 2 }])
  })

  it('add met dubbele vaste sleutel geeft ConstraintError', async () => {
    const db = fresh()
    await db.settings.add({ key: 'k', value: 1 })
    await expect(db.settings.add({ key: 'k', value: 2 })).rejects.toMatchObject({ name: 'ConstraintError' })
    await db.weights.add({ dayKey: 'd', kg: 1 })
    await expect(db.weights.add({ dayKey: 'd', kg: 2 })).rejects.toMatchObject({ name: 'ConstraintError' })
    await db.dayProfiles.add({ dayKey: 'd', profileId: 1 })
    await expect(db.dayProfiles.add({ dayKey: 'd', profileId: 2 })).rejects.toMatchObject({ name: 'ConstraintError' })
  })
})

describe('indexen', () => {
  it('foods: where op name, useCount en lastUsed filtert', async () => {
    const db = fresh()
    await db.foods.bulkAdd([
      v3Food({ name: 'appel', useCount: 1, lastUsed: 10 }),
      v3Food({ name: 'peer', useCount: 2, lastUsed: 20 }),
    ])
    expect((await db.foods.where('name').equals('appel').toArray()).map((f) => f.name)).toEqual(['appel'])
    expect((await db.foods.where('useCount').equals(2).toArray()).map((f) => f.name)).toEqual(['peer'])
    expect((await db.foods.where('lastUsed').equals(10).toArray()).map((f) => f.name)).toEqual(['appel'])
  })

  it('entries: where op dayKey, foodId en batchId filtert', async () => {
    const db = fresh()
    await db.entries.bulkAdd([
      v3Entry({ foodId: 1, dayKey: 'd1', batchId: 'b1' }),
      v3Entry({ foodId: 2, dayKey: 'd2', batchId: 'b2' }),
    ])
    const batches = (es: Entry[]) => es.map((e) => e.batchId)
    expect(batches(await db.entries.where('dayKey').equals('d1').toArray())).toEqual(['b1'])
    expect(batches(await db.entries.where('foodId').equals(2).toArray())).toEqual(['b2'])
    expect(batches(await db.entries.where('batchId').equals('b2').toArray())).toEqual(['b2'])
  })

  it('water: where op dayKey filtert', async () => {
    const db = fresh()
    await db.water.bulkAdd([
      { dayKey: 'd1', ml: 250, createdAt: 0 },
      { dayKey: 'd2', ml: 500, createdAt: 0 },
    ])
    expect((await db.water.where('dayKey').equals('d2').toArray()).map((w) => w.ml)).toEqual([500])
  })

  it('bekend gebrek: favorite (boolean) is niet indexeerbaar, orderBy geeft niets terug', async () => {
    const db = fresh()
    await db.foods.bulkAdd([
      v3Food({ name: 'fav', favorite: true }),
      v3Food({ name: 'geen', favorite: false }),
    ])
    expect(await db.foods.count()).toBe(2)
    expect(await db.foods.orderBy('favorite').toArray()).toEqual([])
  })
})

describe('migratie v1 → v2', () => {
  it('hernoemt maaltijden en vult pinned, overige velden blijven intact', async () => {
    const name = nextName()
    const meals = ['ontbijt', 'lunch', 'diner', 'tussendoor', 'restjes', 'snack']
    const entries = meals.map((meal, i) =>
      v1Entry({
        id: i + 1,
        foodId: i + 1,
        name: `e${i + 1}`,
        per100: targets(100 + i),
        grams: 50 + i,
        dayKey: `2026-11-0${i + 1}`,
        meal,
        createdAt: 1000 + i,
        batchId: `b${i}`,
      }),
    )
    const foodZonder = v1Food({ id: 1, name: 'Appel', favorite: true, useCount: 3, lastUsed: 5, defaultGrams: 40 })
    const foodMet = v1Food({ id: 2, name: 'Peer', pinned: ['avondeten'], useCount: 1, lastUsed: 9 })

    await seedV1(name, async (d) => {
      await d.table<V1Entry, number>('entries').bulkAdd(entries)
      await d.table<V1Food, number>('foods').bulkAdd([foodZonder, foodMet])
    })

    const db = await migrate(name)

    const expectedMeals = ['eerste', 'eerste', 'avondeten', 'tussendoor', 'restjes', 'snack']
    expect(await db.entries.orderBy('id').toArray()).toEqual(
      entries.map((e, i) => ({ ...e, meal: expectedMeals[i] })),
    )
    expect(await db.foods.orderBy('id').toArray()).toEqual([{ ...foodZonder, pinned: [] }, foodMet])
  })

  it('lege v1-database upgradet zonder fout en maakt water bruikbaar', async () => {
    const name = nextName()
    await seedV1(name)
    const db = await migrate(name)
    for (const t of db.tables) expect(await t.count()).toBe(0)
    await db.water.add({ dayKey: 'a', ml: 250, createdAt: 1 })
    expect(await db.water.count()).toBe(1)
  })
})

describe('migratie v2 → v3', () => {
  it('houdt alleen het profiel met laagste id (niet per se 1)', async () => {
    const name = nextName()
    await seedV2(name, async (d) => {
      await d.table<OldProfile, number>('profiles').bulkAdd([
        { id: 10, name: 'Tien', targets: targets(1000) },
        { id: 2, name: 'Twee', targets: targets(200) },
        { id: 5, name: 'Vijf', targets: targets(500) },
      ])
    })
    const db = await migrate(name)
    expect(await db.profiles.toArray()).toEqual([{ id: 2, name: 'Dagdoel', targets: targets(200) }])
  })

  it('hernoemt één enkel profiel zonder id of targets te wijzigen', async () => {
    const name = nextName()
    await seedV2(name, async (d) => {
      await d.table<OldProfile, number>('profiles').add({ id: 7, name: 'Oud', targets: targets(700) })
    })
    const db = await migrate(name)
    expect(await db.profiles.toArray()).toEqual([{ id: 7, name: 'Dagdoel', targets: targets(700) }])
  })

  it('doet niets bij 0 profielen', async () => {
    const name = nextName()
    await seedV2(name)
    const db = await migrate(name)
    expect(await db.profiles.count()).toBe(0)
  })

  it('laat dayProfiles (ook naar verwijderde profielen) en settings ongemoeid', async () => {
    const name = nextName()
    await seedV2(name, async (d) => {
      await d.table<OldProfile, number>('profiles').bulkAdd([
        { id: 2, name: 'Behouden', targets: targets(200) },
        { id: 10, name: 'Verwijderd', targets: targets(1000) },
      ])
      await d.table<DayProfile, string>('dayProfiles').bulkAdd([
        { dayKey: '2026-11-18', profileId: 2 },
        { dayKey: '2026-11-19', profileId: 10 },
      ])
      await d.table<Setting, string>('settings').add({ key: 'dayStart', value: '04:00' })
    })
    const db = await migrate(name)
    expect(await db.profiles.toArray()).toEqual([{ id: 2, name: 'Dagdoel', targets: targets(200) }])
    expect(await db.dayProfiles.orderBy('dayKey').toArray()).toEqual([
      { dayKey: '2026-11-18', profileId: 2 },
      { dayKey: '2026-11-19', profileId: 10 },
    ])
    expect(await db.settings.toArray()).toEqual([{ key: 'dayStart', value: '04:00' }])
  })
})

describe('migratie v1 → v3 end-to-end', () => {
  it('doorloopt beide migraties met data in één upgrade en behoudt indexen', async () => {
    const name = nextName()
    const entries = [
      v1Entry({ id: 1, meal: 'ontbijt', batchId: 'x' }),
      v1Entry({ id: 2, meal: 'lunch', batchId: 'y' }),
      v1Entry({ id: 3, meal: 'diner' }),
      v1Entry({ id: 4, meal: 'snack' }),
    ]
    const foodZonder = v1Food({ id: 1, name: 'Appel' })
    const foodMet = v1Food({ id: 2, name: 'Peer', pinned: ['restjes'] })

    await seedV1(name, async (d) => {
      await d.table<V1Entry, number>('entries').bulkAdd(entries)
      await d.table<V1Food, number>('foods').bulkAdd([foodZonder, foodMet])
      await d.table<OldProfile, number>('profiles').bulkAdd([
        { id: 5, name: 'Vijf', targets: targets(500) },
        { id: 2, name: 'Twee', targets: targets(200) },
        { id: 9, name: 'Negen', targets: targets(900) },
      ])
    })

    const db = await migrate(name)

    const expectedMeals = ['eerste', 'eerste', 'avondeten', 'snack']
    expect(await db.entries.orderBy('id').toArray()).toEqual(
      entries.map((e, i) => ({ ...e, meal: expectedMeals[i] })),
    )
    expect(await db.foods.orderBy('id').toArray()).toEqual([{ ...foodZonder, pinned: [] }, foodMet])
    expect(await db.profiles.toArray()).toEqual([{ id: 2, name: 'Dagdoel', targets: targets(200) }])

    expect((await db.entries.where('batchId').equals('x').toArray()).map((e) => e.id)).toEqual([1])
    await db.water.bulkAdd([
      { dayKey: 'a', ml: 250, createdAt: 1 },
      { dayKey: 'b', ml: 500, createdAt: 2 },
    ])
    expect((await db.water.where('dayKey').equals('b').toArray()).map((w) => w.ml)).toEqual([500])
  })
})