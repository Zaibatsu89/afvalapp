import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { seedDefaults } from './seed'

const defaults = { name: 'Dagdoel', targets: { kcal: 1500, protein: 100, carbs: 130, fat: 50 } }

beforeEach(async () => {
  await db.profiles.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('seedDefaults', () => {
  it('voegt het dagdoel toe als er nog geen profielen zijn', async () => {
    await expect(seedDefaults()).resolves.toBeUndefined()
    const profiles = await db.profiles.toArray()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject(defaults)
  })

  it('is idempotent: een tweede aanroep voegt niets toe', async () => {
    await seedDefaults()
    await seedDefaults()
    expect(await db.profiles.count()).toBe(1)
  })

  it('overschrijft of dupliceert bestaande profielen niet', async () => {
    await db.profiles.add({ name: 'Eigen doel', targets: { kcal: 2000, protein: 120, carbs: 200, fat: 60 } })
    const addSpy = vi.spyOn(db.profiles, 'add')
    await seedDefaults()
    expect(addSpy).not.toHaveBeenCalled()
    const profiles = await db.profiles.toArray()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Eigen doel')
  })

  it('propageert een fout van de database en schrijft niets', async () => {
    vi.spyOn(db.profiles, 'count').mockRejectedValueOnce(new Error('db kapot'))
    await expect(seedDefaults()).rejects.toThrow('db kapot')
    expect(await db.profiles.count()).toBe(0)
  })

  it('propageert een fout bij het toevoegen', async () => {
    vi.spyOn(db.profiles, 'add').mockRejectedValueOnce(new Error('schrijffout'))
    await expect(seedDefaults()).rejects.toThrow('schrijffout')
    expect(await db.profiles.count()).toBe(0)
  })
})
