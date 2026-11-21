import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type Entry, type Food } from '../db'
import { download, exportCsv, exportJson, importJson } from './backup'

const per100 = { kcal: 200, protein: 10, carbs: 5, fat: 2 }
const food: Food = { id: 1, name: 'Havermout', per100, defaultGrams: 50, favorite: false, pinned: [], useCount: 0, lastUsed: 0 }
const entry: Entry = { id: 1, foodId: 1, dayKey: '2024-01-01', meal: 'eerste', name: 'Havermout', grams: 150, per100, createdAt: 0 }

beforeEach(async () => {
  await Promise.all([db.foods, db.entries, db.profiles, db.dayProfiles, db.weights, db.settings, db.water].map((t) => t.clear()))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('exportJson', () => {
  it('bevat alle tabellen en laat de API-sleutel weg', async () => {
    await db.foods.add(food)
    await db.entries.add(entry)
    await db.settings.bulkAdd([{ key: 'geminiKey', value: 'geheim' }, { key: 'thema', value: 'licht' }])
    const text = await exportJson()
    const out = JSON.parse(text)
    expect(out.v).toBe(1)
    expect(out.foods).toEqual([food])
    expect(out.entries).toEqual([entry])
    expect(out.settings).toEqual([{ key: 'thema', value: 'licht' }])
    expect(text).not.toContain('geheim')
  })

  it('geeft lege lijsten bij een lege database', async () => {
    const out = JSON.parse(await exportJson())
    expect(out.foods).toEqual([])
    expect(out.entries).toEqual([])
  })
})

describe('importJson', () => {
  it('herstelt een export en vervangt bestaande data', async () => {
    await db.foods.add(food)
    const backup = await exportJson()
    await db.foods.clear()
    await db.foods.add({ ...food, id: 2, name: 'Oud' })
    await importJson(backup)
    expect(await db.foods.toArray()).toEqual([food])
  })

  it('vertaalt oude maaltijdnamen en laat andere ongemoeid', async () => {
    const meals = ['ontbijt', 'lunch', 'diner', 'snack']
    const entries = meals.map((meal, i) => ({ ...entry, id: i + 10, meal }))
    await importJson(JSON.stringify({ v: 1, foods: [], entries }))
    const got = (await db.entries.toArray()).map((e) => e.meal).sort()
    expect(got).toEqual(['avondeten', 'eerste', 'eerste', 'snack'])
  })

  it('zet pinned op [] als een product het veld mist', async () => {
    await importJson(JSON.stringify({ v: 1, foods: [{ ...food, pinned: undefined }], entries: [] }))
    expect((await db.foods.get(1))?.pinned).toEqual([])
  })

  it.each([
    ['geen JSON', 'niet json'],
    ['null', 'null'],
    ['verkeerde versie', JSON.stringify({ v: 2, foods: [], entries: [] })],
    ['ontbrekende entries', JSON.stringify({ v: 1, foods: [] })],
  ])('weigert %s en laat bestaande data staan', async (_label, text) => {
    await db.foods.add(food)
    await expect(importJson(text)).rejects.toThrow()
    expect(await db.foods.toArray()).toEqual([food])
  })
})

describe('exportCsv', () => {
  it('geeft alleen de kop bij een lege database', async () => {
    expect(await exportCsv()).toBe('dag,maaltijd,product,gram,kcal,eiwit,koolhydraten,vet')
  })

  it('schaalt naar grammen, rondt af en escapet aanhalingstekens', async () => {
    await db.entries.add({ ...entry, name: 'Kaas "oud"' })
    const lines = (await exportCsv()).split('\n')
    expect(lines[1]).toBe('2024-01-01,eerste,"Kaas ""oud""",150,300,15,7.5,3')
  })
})

describe('download', () => {
  it('maakt een blob-link aan, klikt die en ruimt de URL op', () => {
    const a = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => a) })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    download('backup.json', '{}', 'application/json')
    expect(a.download).toBe('backup.json')
    expect(a.href).toBe('blob:x')
    expect(a.click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
