import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, MEALS, type Food } from '../db'
import AddFood from './AddFood'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../lib/toast', () => ({ useToast: () => toast }))
vi.mock('./WeighButton', () => ({ WeighButton: () => null }))
vi.mock('./FoodForm', async () => {
  const { createElement } = await import('react')
  return { FoodForm: ({ initialName }: { initialName?: string }) => createElement('div', null, `Formulier ${initialName ?? ''}`) }
})

const meal = MEALS[0]
const food = (name: string, defaultGrams = 100) =>
  ({ name, per100: { kcal: 100, protein: 10, carbs: 5, fat: 2 }, defaultGrams, pinned: [], favorite: false, useCount: 0, lastUsed: 0 }) as unknown as Food

const renderScreen = () =>
  render(<AddFood day="2024-05-01" todayKey="2024-05-01" meal={meal} setMeal={vi.fn()} onBack={vi.fn()} />)

beforeEach(async () => {
  await db.foods.clear()
  await db.entries.clear()
  toast.mockClear()
})
afterAll(() => db.close())

describe('AddFood', () => {
  it('filtert producten op zoekterm', async () => {
    await db.foods.bulkAdd([food('Kipfilet'), food('Appel')])
    renderScreen()
    expect(await screen.findByText('Kipfilet')).toBeInTheDocument()
    await userEvent.setup().type(screen.getByPlaceholderText('Zoek product…'), 'app')
    await waitFor(() => expect(screen.queryByText('Kipfilet')).not.toBeInTheDocument())
    expect(screen.getByText('Appel')).toBeInTheDocument()
  })

  it('voegt product met één tik toe aan de dag', async () => {
    await db.foods.add(food('Kipfilet'))
    renderScreen()
    await userEvent.setup().click(await screen.findByText('Kipfilet'))
    await waitFor(async () => expect(await db.entries.count()).toBe(1))
    expect((await db.entries.toArray())[0]).toMatchObject({ name: 'Kipfilet', grams: 100, dayKey: '2024-05-01' })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ text: 'Kipfilet · 100 g toegevoegd' }))
  })

  it('voegt andere hoeveelheid toe via het gewichtsvenster', async () => {
    await db.foods.add(food('Kipfilet'))
    renderScreen()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Andere hoeveelheid' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '250' } })
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    await waitFor(async () => expect((await db.entries.toArray())[0]?.grams).toBe(250))
  })

  it('opent het nieuwe-productformulier met de zoekterm', async () => {
    renderScreen()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Zoek product…'), 'Nieuw ding')
    await user.click(await screen.findByText(/Maak "Nieuw ding" aan/))
    expect(await screen.findByText('Formulier Nieuw ding')).toBeInTheDocument()
  })
})
