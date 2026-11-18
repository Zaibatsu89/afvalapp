import Dexie, { type EntityTable } from 'dexie'
import type { Macros } from './lib/nutrition'

export interface Food {
  id?: number
  name: string
  per100: Macros
  /** Standaard hoeveelheid in gram bij toevoegen met één tik. */
  defaultGrams: number
  favorite: boolean
  /** Categorieën waarin dit product "vast" is en bovenaan staat. */
  pinned: Meal[]
  useCount: number
  lastUsed: number
}

export type Meal = 'eerste' | 'avondeten' | 'tussendoor' | 'restjes'
export const MEALS: Meal[] = ['eerste', 'avondeten', 'restjes', 'tussendoor']
export const MEAL_LABELS: Record<Meal, string> = {
  eerste: 'Eerste Maaltijd',
  avondeten: 'Avondeten',
  tussendoor: 'Tussendoor',
  restjes: 'Restjes',
}

export interface Entry {
  id?: number
  foodId: number
  name: string
  per100: Macros
  grams: number
  dayKey: string
  meal: Meal
  createdAt: number
  /** Idempotentie-token: een kopieeractie met dit token voegt maar één keer toe. */
  batchId?: string
}

export interface TargetProfile {
  id?: number
  name: string
  targets: Macros
}

export interface DayProfile {
  dayKey: string
  profileId: number
}

export interface WeightLog {
  dayKey: string
  kg: number
}

export interface WaterLog {
  id?: number
  dayKey: string
  ml: number
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export class AfvalDB extends Dexie {
  foods!: EntityTable<Food, 'id'>
  entries!: EntityTable<Entry, 'id'>
  profiles!: EntityTable<TargetProfile, 'id'>
  dayProfiles!: EntityTable<DayProfile, 'dayKey'>
  weights!: EntityTable<WeightLog, 'dayKey'>
  settings!: EntityTable<Setting, 'key'>
  water!: EntityTable<WaterLog, 'id'>

  constructor(name = 'afvalapp') {
    super(name)
    this.version(1).stores({
      foods: '++id, name, favorite, lastUsed, useCount',
      entries: '++id, dayKey, foodId, batchId',
      profiles: '++id',
      dayProfiles: 'dayKey',
      weights: 'dayKey',
      settings: 'key',
    })
    this.version(2)
      .stores({ water: '++id, dayKey' })
      .upgrade(async (tx) => {
        const map: Record<string, Meal> = { ontbijt: 'eerste', lunch: 'eerste', diner: 'avondeten' }
        await tx.table('entries').toCollection().modify((e: { meal: string }) => {
          e.meal = map[e.meal] ?? e.meal
        })
        await tx.table('foods').toCollection().modify((f: { pinned?: Meal[] }) => {
          f.pinned ??= []
        })
      })
    // v3: één vast dagdoel; het eerste profiel blijft over.
    this.version(3).upgrade(async (tx) => {
      const all = await tx.table('profiles').orderBy('id').toArray()
      if (all.length > 1) await tx.table('profiles').bulkDelete(all.slice(1).map((p: { id: number }) => p.id))
      if (all[0]) await tx.table('profiles').update(all[0].id, { name: 'Dagdoel' })
    })
  }
}

export const db = new AfvalDB()
