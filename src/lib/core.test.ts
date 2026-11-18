import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { AfvalDB, type Food } from '../db'
import { dayKeyFor, shiftDay, parseTime } from './day'
import { addFoodToDay, copyEntries, undoEntries } from './actions'
import { kcalLooksWrong, scale, sum } from './nutrition'
import { searchFoods } from './search'

const START = parseTime('04:00')
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()

describe('dayKeyFor', () => {
  it('na middernacht hoort nog bij de vorige dag', () => {
    expect(dayKeyFor(at(2026, 11, 19, 0, 30), START)).toBe('2026-11-18')
    expect(dayKeyFor(at(2026, 11, 19, 3, 59), START)).toBe('2026-11-18')
  })
  it('vanaf dagstart begint nieuwe dag', () => {
    expect(dayKeyFor(at(2026, 11, 19, 4, 0), START)).toBe('2026-11-19')
  })
  it('maand- en jaargrens', () => {
    expect(dayKeyFor(at(2027, 1, 1, 2), START)).toBe('2026-12-31')
    expect(dayKeyFor(at(2026, 3, 1, 1), START)).toBe('2026-02-28')
  })
  it('zomertijd-overgang (29 maart 2026)', () => {
    expect(dayKeyFor(at(2026, 3, 29, 3, 30), START)).toBe('2026-03-28')
    expect(dayKeyFor(at(2026, 3, 29, 4, 0), START)).toBe('2026-03-29')
  })
  it('aangepaste dagstart', () => {
    expect(dayKeyFor(at(2026, 11, 19, 5, 59), parseTime('06:00'))).toBe('2026-11-18')
  })
  it('shiftDay', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('nutrition', () => {
  it('rekent per gram om', () => {
    expect(scale({ kcal: 200, protein: 10, carbs: 20, fat: 5 }, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 })
  })
  it('telt op', () => {
    expect(sum([{ kcal: 1, protein: 1.1, carbs: 0, fat: 0 }, { kcal: 2, protein: 2.2, carbs: 0, fat: 0 }]).protein).toBe(3.3)
  })
  it('detecteert onwaarschijnlijke kcal', () => {
    expect(kcalLooksWrong({ kcal: 400, protein: 10, carbs: 50, fat: 15 })).toBe(false)
    expect(kcalLooksWrong({ kcal: 40, protein: 10, carbs: 50, fat: 15 })).toBe(true)
  })
})

let db: AfvalDB
let n = 0
beforeEach(() => {
  db = new AfvalDB(`test-${n++}`)
})

async function mk(name: string, extra: Partial<Food> = {}) {
  const f: Food = { name, per100: { kcal: 100, protein: 5, carbs: 10, fat: 2 }, defaultGrams: 100, favorite: false, pinned: [], useCount: 0, lastUsed: 0, ...extra }
  f.id = (await db.foods.add(f)) as number
  return f
}

describe('toevoegen en kopiëren', () => {
  it('één tik voegt toe; undo verwijdert', async () => {
    const f = await mk('Havermout')
    const id = await addFoodToDay(f, '2026-11-18', 'eerste', undefined, db)
    expect(await db.entries.count()).toBe(1)
    await undoEntries([id], db)
    expect(await db.entries.count()).toBe(0)
  })
  it('kopiëren met zelfde batchId is idempotent', async () => {
    const f = await mk('Ei')
    const a = await addFoodToDay(f, '2026-11-17', 'avondeten', 50, db)
    const first = await copyEntries([a], '2026-11-18', 'b1', undefined, db)
    const second = await copyEntries([a], '2026-11-18', 'b1', undefined, db)
    expect(second).toEqual(first)
    expect(await db.entries.where('dayKey').equals('2026-11-18').count()).toBe(1)
  })
})

describe('zoeken', () => {
  it('"oer" vindt woordbegin eerst en zet favoriet/vaak gebruikt bovenaan', async () => {
    const foods = [
      await mk('Oerbrood', { useCount: 2 }),
      await mk('Havermout oer', { favorite: true, useCount: 30 }),
      await mk('Boerenkool'),
      await mk('Appel'),
    ]
    const r = searchFoods(foods, 'oer').map((f) => f.name)
    expect(r).not.toContain('Appel')
    expect(r[0]).toBe('Havermout oer')
    expect(r.at(-1)).toBe('Boerenkool')
  })
  it('"wilde zalm" vindt alleen producten met beide woorden', async () => {
    const foods = [await mk('Wilde zalm filet'), await mk('Zalmsalade'), await mk('Wilde rijst')]
    expect(searchFoods(foods, 'wilde zalm').map((f) => f.name)).toEqual(['Wilde zalm filet'])
  })
})

import { labelToPer100, scaleToGrams } from './gemini'
describe('gemini helpers', () => {
  it('rekent portie-tabel om naar per 100 g', () => {
    expect(labelToPer100({ name: null, perAmount: 50, kcal: 100, protein: 5, carbs: null, fat: 1 })).toEqual({ kcal: 200, protein: 10, carbs: null, fat: 2 })
  })
  it('weegschaal-eenheden', () => {
    expect(scaleToGrams({ value: 1.2, unit: 'kg' })).toBe(1200)
    expect(scaleToGrams({ value: null, unit: 'g' })).toBeNull()
    expect(scaleToGrams({ value: 85, unit: null })).toBe(85)
  })
})

describe('vast voedsel en water', () => {
  it('gepinde producten van de categorie staan bovenaan, ook boven favoriet', async () => {
    const foods = [
      await mk('Appel', { favorite: true, useCount: 99 }),
      await mk('Havermout', { pinned: ['eerste'] }),
      await mk('Banaan', { pinned: ['avondeten'] }),
    ]
    const r = searchFoods(foods, '', false, 'eerste').map((f) => f.name)
    expect(r[0]).toBe('Havermout')
    expect(r.indexOf('Appel')).toBeLessThan(r.indexOf('Banaan'))
  })
  it('water: toevoegen en undo', async () => {
    const { addWater, undoWater } = await import('./actions')
    const a = await addWater(500, '2026-11-18', db)
    await addWater(500, '2026-11-18', db)
    expect((await db.water.where('dayKey').equals('2026-11-18').toArray()).reduce((s, w) => s + w.ml, 0)).toBe(1000)
    await undoWater(a, db)
    expect(await db.water.count()).toBe(1)
  })
})

describe('migratie v3', () => {
  it('houdt één profiel over', async () => {
    const name = `mig-${n++}`
    const old = new AfvalDB(name)
    old.close()
    const { default: Dexie } = await import('dexie')
    const v2 = new Dexie(name)
    v2.version(2).stores({ foods: '++id', entries: '++id, dayKey, foodId, batchId', profiles: '++id', dayProfiles: 'dayKey', weights: 'dayKey', settings: 'key', water: '++id, dayKey' })
    await v2.table('profiles').bulkAdd([{ name: 'Rustdag', targets: { kcal: 1 } }, { name: 'Sportdag', targets: { kcal: 2 } }])
    v2.close()
    const d = new AfvalDB(name)
    const ps = await d.profiles.toArray()
    expect(ps).toHaveLength(1)
    expect(ps[0].targets.kcal).toBe(1)
  })
})
