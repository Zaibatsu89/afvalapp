import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { FoodForm } from './FoodForm'

beforeEach(async () => {
  await db.foods.clear()
})
afterAll(() => db.close())

describe('FoodForm', () => {
  it('blokkeert opslaan zonder naam en calorieën', async () => {
    const user = userEvent.setup()
    render(<FoodForm onClose={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Opslaan' })
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText(/Calorieën/), '60')
    expect(save).toBeDisabled()
  })

  it('vult de naam vooraf in met initialName', () => {
    render(<FoodForm initialName="Appel" onClose={vi.fn()} />)
    expect(screen.getByLabelText('Naam')).toHaveValue('Appel')
  })

  it('slaat een nieuw product op met standaard 100 g', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FoodForm onClose={onClose} />)
    await user.type(screen.getByLabelText('Naam'), 'Kwark')
    await user.type(screen.getByLabelText(/Calorieën/), '60')
    await user.click(screen.getByRole('button', { name: 'Opslaan' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const rows = await db.foods.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Kwark', defaultGrams: 100, per100: { kcal: 60, protein: 0, carbs: 0, fat: 0 } })
  })

  it('werkt een bestaand product bij', async () => {
    const user = userEvent.setup()
    const id = await db.foods.add({ name: 'Skyr', per100: { kcal: 60, protein: 11, carbs: 4, fat: 0 }, defaultGrams: 150, favorite: false, pinned: [], useCount: 0, lastUsed: 0 })
    const food = (await db.foods.get(id))!
    const onClose = vi.fn()
    render(<FoodForm food={food} onClose={onClose} />)
    expect(screen.getByRole('heading', { name: 'Product bewerken' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Naam'))
    await user.type(screen.getByLabelText('Naam'), 'Griekse skyr')
    await user.click(screen.getByRole('button', { name: 'Opslaan' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect((await db.foods.get(id))?.name).toBe('Griekse skyr')
  })

  it('verwijdert een bestaand product', async () => {
    const user = userEvent.setup()
    const id = await db.foods.add({ name: 'Ei', per100: { kcal: 150, protein: 13, carbs: 1, fat: 11 }, defaultGrams: 60, favorite: false, pinned: [], useCount: 0, lastUsed: 0 })
    const onClose = vi.fn()
    render(<FoodForm food={(await db.foods.get(id))!} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Verwijder' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(await db.foods.count()).toBe(0)
  })

  it('sluit zonder opslaan bij Annuleren', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FoodForm onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await db.foods.count()).toBe(0)
  })
})
