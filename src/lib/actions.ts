import type { AfvalDB, Entry, Food, Meal } from '../db'
import { db as defaultDb } from '../db'

export async function getSetting<T>(key: string, fallback: T, db: AfvalDB = defaultDb): Promise<T> {
  const s = await db.settings.get(key)
  return (s?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown, db: AfvalDB = defaultDb) {
  await db.settings.put({ key, value })
}

/** Eén tik: product direct toevoegen. Geeft entry-id terug voor "Ongedaan maken". */
export async function addFoodToDay(
  food: Food,
  dayKey: string,
  meal: Meal,
  grams = food.defaultGrams,
  db: AfvalDB = defaultDb,
): Promise<number> {
  return db.transaction('rw', db.entries, db.foods, async () => {
    const id = await db.entries.add({
      foodId: food.id!,
      name: food.name,
      per100: food.per100,
      grams,
      dayKey,
      meal,
      createdAt: Date.now(),
    })
    await db.foods.update(food.id!, { useCount: food.useCount + 1, lastUsed: Date.now() })
    return id as number
  })
}

/**
 * Kopieer entries naar een dag. `batchId` maakt het idempotent: tweede aanroep
 * met hetzelfde token doet niets en geeft dezelfde ids terug.
 */
export async function copyEntries(
  sourceIds: number[],
  dayKey: string,
  batchId: string,
  meal?: Meal,
  db: AfvalDB = defaultDb,
): Promise<number[]> {
  return db.transaction('rw', db.entries, async () => {
    const existing = await db.entries.where('batchId').equals(batchId).primaryKeys()
    if (existing.length > 0) return existing as number[]
    const sources = (await db.entries.bulkGet(sourceIds)).filter((e): e is Entry => !!e)
    const now = Date.now()
    const copies: Entry[] = sources.map(({ id: _id, ...e }) => ({
      ...e,
      dayKey,
      meal: meal ?? e.meal,
      createdAt: now,
      batchId,
    }))
    return (await db.entries.bulkAdd(copies, { allKeys: true })) as number[]
  })
}

export async function undoEntries(ids: number[], db: AfvalDB = defaultDb) {
  await db.entries.bulkDelete(ids)
}

export async function moveEntryToDay(id: number, dayKey: string, db: AfvalDB = defaultDb) {
  await db.entries.update(id, { dayKey })
}

export async function setEntryGrams(id: number, grams: number, db: AfvalDB = defaultDb) {
  await db.entries.update(id, { grams })
}

export async function addWater(ml: number, dayKey: string, db: AfvalDB = defaultDb): Promise<number> {
  return (await db.water.add({ ml, dayKey, createdAt: Date.now() })) as number
}

export async function undoWater(id: number, db: AfvalDB = defaultDb) {
  await db.water.delete(id)
}

export async function togglePinned(food: Food, meal: Meal, db: AfvalDB = defaultDb) {
  const pinned = food.pinned.includes(meal) ? food.pinned.filter((m) => m !== meal) : [...food.pinned, meal]
  await db.foods.update(food.id!, { pinned })
}
