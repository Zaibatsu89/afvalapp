export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

const round1 = (n: number) => Math.round(n * 10) / 10

/** Waarden per 100 g omrekenen naar `grams`. */
export function scale(per100: Macros, grams: number): Macros {
  const f = grams / 100
  return {
    kcal: Math.round(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  }
}

export function sum(items: Macros[]): Macros {
  const t = items.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
    }),
    ZERO,
  )
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) }
}

export function kcalFromMacros(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return Math.round(4 * m.protein + 4 * m.carbs + 9 * m.fat)
}

/** True als de uitgelezen kcal sterk afwijkt van wat de macro's opleveren (leesfout?). */
export function kcalLooksWrong(m: Macros, tolerance = 0.2): boolean {
  const expected = kcalFromMacros(m)
  if (expected === 0 && m.kcal === 0) return false
  const base = Math.max(expected, m.kcal, 1)
  return Math.abs(expected - m.kcal) / base > tolerance
}
