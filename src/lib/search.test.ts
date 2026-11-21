import { describe, expect, it } from 'vitest'
import type { Food } from '../db'
import { searchFoods } from './search'

const base: Omit<Food, 'name'> = {
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
  defaultGrams: 100,
  favorite: false,
  pinned: [],
  useCount: 0,
  lastUsed: 0,
}
const food = (name: string, over: Partial<Food> = {}): Food => ({ ...base, name, ...over })
const names = (fs: Food[]) => fs.map((f) => f.name)

describe('searchFoods', () => {
  it('lege query sorteert op gebruik', () => {
    const foods = [food('Appel', { useCount: 5 }), food('Peer', { useCount: 10 }), food('Banaan', { useCount: 1 })]
    expect(names(searchFoods(foods, ''))).toEqual(['Peer', 'Appel', 'Banaan'])
  })

  it('woordbegin weegt zwaarder dan deel van een woord en sluit niet-matches uit', () => {
    const foods = [food('Boerenkool'), food('Oerbrood'), food('Appel')]
    expect(names(searchFoods(foods, 'oer'))).toEqual(['Oerbrood', 'Boerenkool'])
  })

  it('alle zoektermen moeten voorkomen', () => {
    const foods = [food('Wilde zalm filet'), food('Zalmsalade'), food('Wilde rijst')]
    expect(names(searchFoods(foods, 'wilde zalm'))).toEqual(['Wilde zalm filet'])
  })

  it('is ongevoelig voor hoofdletters en accenten', () => {
    const foods = [food('Crème brûlée'), food('Appel')]
    expect(names(searchFoods(foods, 'CREME'))).toEqual(['Crème brûlée'])
  })

  it('onlyFavorites toont alleen favorieten', () => {
    const foods = [food('Appel', { favorite: true }), food('Peer')]
    expect(names(searchFoods(foods, '', true))).toEqual(['Appel'])
  })

  it('gepinde producten voor de maaltijd staan bovenaan, ook boven favoriet', () => {
    const foods = [
      food('Appel', { favorite: true, useCount: 99 }),
      food('Havermout', { pinned: ['eerste'] }),
      food('Banaan', { pinned: ['avondeten'] }),
    ]
    expect(names(searchFoods(foods, '', false, 'eerste'))).toEqual(['Havermout', 'Appel', 'Banaan'])
  })

  it('gelijke score: useCount wordt bij 500 afgekapt, daarna alfabetisch op naam', () => {
    const foods = [food('Zwart', { useCount: 1000 }), food('Appel', { useCount: 500 })]
    expect(names(searchFoods(foods, ''))).toEqual(['Appel', 'Zwart'])
  })

  it('geeft een lege lijst bij lege invoer of geen treffers', () => {
    expect(searchFoods([], 'x')).toEqual([])
    expect(searchFoods([food('Appel')], 'zzz')).toEqual([])
  })
})
