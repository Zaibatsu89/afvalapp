import { db } from './db'

export async function seedDefaults() {
  if ((await db.profiles.count()) === 0) {
    await db.profiles.add({ name: 'Dagdoel', targets: { kcal: 1500, protein: 100, carbs: 130, fat: 50 } })
  }
}
