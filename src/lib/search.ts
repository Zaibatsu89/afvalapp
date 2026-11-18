import type { Food, Meal } from '../db'

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Score: hoger = eerder tonen. Begin van woord weegt zwaarder dan deel van woord;
 * daarna favoriet, vaak gebruikt, recent gebruikt. Lege query = alleen gebruiksranking.
 */
export function searchFoods(foods: Food[], query: string, onlyFavorites = false, meal?: Meal): Food[] {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  const scored: { f: Food; s: number }[] = []
  for (const f of foods) {
    if (onlyFavorites && !f.favorite) continue
    const name = norm(f.name)
    const words = name.split(/[^a-z0-9]+/).filter(Boolean)
    let match = 0
    let ok = true
    for (const t of terms) {
      if (words.some((w) => w.startsWith(t))) match += 100
      else if (name.includes(t)) match += 40
      else {
        ok = false
        break
      }
    }
    if (!ok) continue
    const usage = (meal && f.pinned?.includes(meal) ? 100_000 : 0) + (f.favorite ? 1_000 : 0) + Math.min(f.useCount, 500) * 2 + f.lastUsed / 1e13
    scored.push({ f, s: usage + match * 10 })
  }
  return scored.sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name, 'nl')).map((x) => x.f)
}
