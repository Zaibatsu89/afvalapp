import { describe, expect, it } from 'vitest'
import { ZERO, kcalFromMacros, kcalLooksWrong, scale, sum, type Macros } from './nutrition'

const M: Macros = { kcal: 400, protein: 10, carbs: 50, fat: 15 }

describe('ZERO', () => {
  it('bevat alleen nullen', () => {
    expect(ZERO).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('scale', () => {
  it('rekent per 100 g om naar de gevraagde hoeveelheid', () => {
    expect(scale({ kcal: 200, protein: 10, carbs: 20, fat: 5 }, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 })
  })
  it('100 g geeft dezelfde waarden terug', () => {
    expect(scale(M, 100)).toEqual(M)
  })
  it('0 g geeft nullen', () => {
    expect(scale(M, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
  it('kcal wordt afgerond op hele getallen (0,5 naar boven)', () => {
    expect(scale({ kcal: 1, protein: 0, carbs: 0, fat: 0 }, 50).kcal).toBe(1)
    expect(scale({ kcal: 1, protein: 0, carbs: 0, fat: 0 }, 40).kcal).toBe(0)
  })
  it('macro\'s worden afgerond op één decimaal', () => {
    expect(scale({ kcal: 0, protein: 3, carbs: 0, fat: 0 }, 33).protein).toBe(1)
  })
  it('ondersteunt fractionele grammen', () => {
    expect(scale({ kcal: 80, protein: 0, carbs: 0, fat: 0 }, 12.5).kcal).toBe(10)
  })
  it('muteert de invoer niet', () => {
    const input = { ...M }
    scale(input, 250)
    expect(input).toEqual(M)
  })
})

describe('sum', () => {
  it('lege lijst geeft nullen', () => {
    expect(sum([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
  it('telt op en rondt eiwit af op één decimaal', () => {
    const r = sum([
      { kcal: 1, protein: 1.1, carbs: 0, fat: 0 },
      { kcal: 2, protein: 2.2, carbs: 0, fat: 0 },
    ])
    expect(r.protein).toBe(3.3)
    expect(r.kcal).toBe(3)
  })
  it('telt macro\'s gewoon op', () => {
    expect(sum([{ kcal: 0, protein: 0.1, carbs: 0.2, fat: 0 }, ZERO]).protein).toBe(0.1)
    expect(sum([{ kcal: 0, protein: 0.1, carbs: 0.2, fat: 0 }, ZERO]).carbs).toBe(0.2)
    expect(sum([{ kcal: 0, protein: 0.1, carbs: 0, fat: 0 }, { kcal: 0, protein: 0.2, carbs: 0, fat: 0 }]).protein).toBe(0.3)
  })
  it('rondt kcal af op hele getallen', () => {
    expect(sum([{ kcal: 0.4, protein: 0, carbs: 0, fat: 0 }, { kcal: 0.4, protein: 0, carbs: 0, fat: 0 }]).kcal).toBe(1)
  })
  it('één item geeft hetzelfde item terug', () => {
    expect(sum([M])).toEqual(M)
  })
  it('muteert de invoer niet', () => {
    const items = [{ ...M }, { ...M }]
    sum(items)
    expect(items).toEqual([M, M])
  })
})

describe('kcalFromMacros', () => {
  it('gebruikt 4 kcal per gram eiwit en koolhydraat, 9 per gram vet', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 })).toBe(165)
  })
  it('nul macro\'s geven 0 kcal', () => {
    expect(kcalFromMacros({ protein: 0, carbs: 0, fat: 0 })).toBe(0)
  })
  it('negeert een eventueel kcal-veld', () => {
    const withKcal = { kcal: 9999, protein: 10, carbs: 20, fat: 5 }
    expect(kcalFromMacros(withKcal)).toBe(165)
  })
  it('rondt af op hele kcal', () => {
    expect(kcalFromMacros({ protein: 0.13, carbs: 0, fat: 0 })).toBe(1)
    expect(kcalFromMacros({ protein: 0.1, carbs: 0, fat: 0 })).toBe(0)
    expect(kcalFromMacros({ protein: 0, carbs: 0, fat: 0.5 })).toBe(5)
  })
})

describe('kcalLooksWrong', () => {
  it('klopt de kcal bij de macro\'s, dan false', () => {
    expect(kcalLooksWrong(M)).toBe(false)
  })
  it('sterk afwijkende kcal geeft true', () => {
    expect(kcalLooksWrong({ ...M, kcal: 40 })).toBe(true)
  })
  it('alle nullen met kcal 0 is geen fout', () => {
    expect(kcalLooksWrong({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBe(false)
  })
  it('macro\'s nul maar wel kcal is een fout', () => {
    expect(kcalLooksWrong({ kcal: 50, protein: 0, carbs: 0, fat: 0 })).toBe(true)
  })
  it('macro\'s aanwezig maar kcal 0 is een fout', () => {
    expect(kcalLooksWrong({ kcal: 0, protein: 10, carbs: 20, fat: 5 })).toBe(true)
  })
  it('grens: precies 20% afwijking is nog niet fout (vergelijking is strikt groter)', () => {
    const edge: Macros = { kcal: 80, protein: 25, carbs: 0, fat: 0 }
    expect(kcalLooksWrong(edge)).toBe(false)
  })
  it('net boven 20% afwijking is fout', () => {
    expect(kcalLooksWrong({ kcal: 79, protein: 25, carbs: 0, fat: 0 })).toBe(true)
  })
  it('afwijking naar boven (kcal hoger dan macro\'s) wordt ook gedetecteerd', () => {
    expect(kcalLooksWrong({ kcal: 1000, protein: 10, carbs: 20, fat: 5 })).toBe(true)
  })
  it('eigen tolerantie wordt gebruikt', () => {
    expect(kcalLooksWrong(M, 0.05)).toBe(true)
    expect(kcalLooksWrong(M, 0.1)).toBe(false)
  })
  it('tolerantie 0 markeert elk verschil', () => {
    expect(kcalLooksWrong({ ...M, kcal: 376 }, 0)).toBe(true)
    expect(kcalLooksWrong({ ...M, kcal: 375 }, 0)).toBe(false)
  })
})
