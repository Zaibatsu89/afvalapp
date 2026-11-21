import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry, Food } from '../db'
import { db } from '../db'
import {
  addFoodToDay, addWater, copyEntries, getSetting, moveEntryToDay, setEntryGrams, setSetting, togglePinned, undoEntries, undoWater,
} from './actions'

const per100 = { kcal: 100, protein: 1, carbs: 1, fat: 1 }
const food: Food = { id: 1, name: 'Appel', per100, defaultGrams: 120, favorite: false, pinned: [], useCount: 2, lastUsed: 0 }
const entry = (over: Partial<Entry> = {}): Entry => ({ foodId: 1, name: 'Appel', per100, grams: 100, dayKey: '2024-01-01', meal: 'eerste', createdAt: 0, ...over })

beforeEach(async () => {
  await Promise.all([db.foods, db.entries, db.water, db.settings].map((t) => t.clear()))
})

afterEach(() => vi.restoreAllMocks())

describe('getSetting / setSetting', () => {
  it('geeft de fallback bij een ontbrekende sleutel en daarna de opgeslagen waarde', async () => {
    expect(await getSetting('x', 5)).toBe(5)
    await setSetting('x', { a: 1 })
    expect(await getSetting('x', 5)).toEqual({ a: 1 })
  })

  it('overschrijft een bestaande waarde', async () => {
    await setSetting('x', 1)
    await setSetting('x', 2)
    expect(await getSetting('x', 0)).toBe(2)
  })

  it('gebruikt de fallback ook bij null', async () => {
    await setSetting('x', null)
    expect(await getSetting('x', 'f')).toBe('f')
  })
})

describe('addFoodToDay', () => {
  it('voegt een entry toe met de standaardgram en verhoogt useCount', async () => {
    await db.foods.add(food)
    const id = await addFoodToDay(food, '2024-01-01', 'tussendoor')
    expect(await db.entries.get(id)).toMatchObject({ foodId: 1, grams: 120, meal: 'tussendoor', dayKey: '2024-01-01' })
    expect((await db.foods.get(1))?.useCount).toBe(3)
  })

  it('gebruikt de meegegeven gram', async () => {
    await db.foods.add(food)
    const id = await addFoodToDay(food, '2024-01-01', 'tussendoor', 30)
    expect((await db.entries.get(id))?.grams).toBe(30)
  })

  it('rolt de entry terug als de productupdate faalt', async () => {
    await db.foods.add(food)
    vi.spyOn(db.foods, 'update').mockRejectedValueOnce(new Error('kapot'))
    await expect(addFoodToDay(food, '2024-01-01', 'tussendoor')).rejects.toThrow('kapot')
    expect(await db.entries.count()).toBe(0)
  })
})

describe('copyEntries', () => {
  it('kopieert naar de nieuwe dag en maaltijd, zonder het oude id', async () => {
    const src = (await db.entries.add(entry())) as number
    const [newId] = await copyEntries([src], '2024-01-02', 'b1', 'avondeten')
    expect(newId).not.toBe(src)
    expect(await db.entries.get(newId)).toMatchObject({ dayKey: '2024-01-02', meal: 'avondeten', batchId: 'b1', grams: 100 })
  })

  it('behoudt de maaltijd als er geen maaltijd is opgegeven', async () => {
    const src = (await db.entries.add(entry())) as number
    const [newId] = await copyEntries([src], '2024-01-02', 'b2')
    expect((await db.entries.get(newId))?.meal).toBe('eerste')
  })

  it('is idempotent bij hetzelfde batchId', async () => {
    const src = (await db.entries.add(entry())) as number
    const first = await copyEntries([src], '2024-01-02', 'b3')
    const second = await copyEntries([src], '2024-01-02', 'b3')
    expect(second).toEqual(first)
    expect(await db.entries.count()).toBe(2)
  })

  it('negeert onbekende bron-ids', async () => {
    expect(await copyEntries([999], '2024-01-02', 'b4')).toEqual([])
  })
})

describe('entry-acties', () => {
  it('undoEntries verwijdert alleen de genoemde entries', async () => {
    const a = (await db.entries.add(entry())) as number
    await db.entries.add(entry())
    await undoEntries([a])
    expect(await db.entries.count()).toBe(1)
  })

  it('moveEntryToDay en setEntryGrams passen het veld aan', async () => {
    const id = (await db.entries.add(entry())) as number
    await moveEntryToDay(id, '2024-02-02')
    await setEntryGrams(id, 250)
    expect(await db.entries.get(id)).toMatchObject({ dayKey: '2024-02-02', grams: 250 })
  })
})

describe('water', () => {
  it('addWater slaat op en undoWater verwijdert', async () => {
    const id = await addWater(250, '2024-01-01')
    expect(await db.water.get(id)).toMatchObject({ ml: 250, dayKey: '2024-01-01' })
    await undoWater(id)
    expect(await db.water.count()).toBe(0)
  })
})

describe('togglePinned', () => {
  it('zet een maaltijd erbij en haalt hem bij een tweede aanroep weer weg', async () => {
    await db.foods.add(food)
    await togglePinned(food, 'eerste')
    expect((await db.foods.get(1))?.pinned).toEqual(['eerste'])
    await togglePinned({ ...food, pinned: ['eerste'] }, 'eerste')
    expect((await db.foods.get(1))?.pinned).toEqual([])
  })
})
