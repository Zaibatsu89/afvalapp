import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, MEALS, MEAL_LABELS, type Entry } from '../db'
import Today from './Today'
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../lib/toast', () => ({ useToast: () => toast }))
vi.mock('./WeighButton', () => ({ WeighButton: () => null }))
const DAY = '2024-05-01'
const meal = MEALS[0]
const entry = (name: string, grams: number): Entry =>
  ({ foodId: 1, name, per100: { kcal: 200, protein: 10, carbs: 20, fat: 5 }, grams, dayKey: DAY, meal, createdAt: Date.now() }) as Entry
const renderToday = (goAdd = vi.fn()) =>
  render(<Today day={DAY} setDay={vi.fn()} todayKey="2024-05-02" goAdd={goAdd} />)
beforeEach(async () => {
  await db.entries.clear()
  await db.water.clear()
  await db.settings.clear()
  toast.mockClear()
})
afterAll(() => db.close())
describe('Today', () => {
  it('toont de items van de dag met kcal per maaltijd', async () => {
    await db.entries.bulkAdd([entry('Havermout', 50), entry('Kwark', 150)])
    renderToday()
    expect(await screen.findByText('Havermout')).toBeInTheDocument()
    expect(screen.getByText('Kwark')).toBeInTheDocument()
    // 50 g = 100 kcal, 150 g = 300 kcal, samen 400 kcal in deze maaltijd
    expect(screen.getByText('400 kcal')).toBeInTheDocument()
  })
  it('toont alleen items van de gekozen dag', async () => {
    await db.entries.add({ ...entry('Appeltaart', 100), dayKey: '2024-04-30' })
    renderToday()
    await screen.findAllByLabelText(/Toevoegen aan/)
    expect(screen.queryByText('Appeltaart')).not.toBeInTheDocument()
  })
  it('opent de ＋-knop van een maaltijd met die maaltijd', async () => {
    const goAdd = vi.fn()
    renderToday(goAdd)
    await userEvent.setup().click(await screen.findByLabelText(`Toevoegen aan ${MEAL_LABELS[meal]}`))
    expect(goAdd).toHaveBeenCalledWith(meal)
  })
  it('verwijdert een item en biedt ongedaan maken aan', async () => {
    await db.entries.add(entry('Havermout', 50))
    renderToday()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Havermout'))
    await user.click(screen.getByRole('button', { name: 'Verwijder' }))
    await waitFor(async () => expect(await db.entries.count()).toBe(0))
    expect(screen.queryByText('Havermout')).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ text: 'Havermout verwijderd' }))
  })
  it('kopieert de maaltijden van de dag ervoor', async () => {
    await db.entries.add({ ...entry('Kwark', 150), dayKey: '2024-04-30' })
    renderToday()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Zelfde als dag ervoor (1)' }))
    await waitFor(async () => expect(await db.entries.where('dayKey').equals(DAY).count()).toBe(1))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ text: '1 toegevoegd' }))
  })
  it('wisselt van dag met de vorige en volgende knop', async () => {
    const setDay = vi.fn()
    render(<Today day={DAY} setDay={setDay} todayKey="2024-05-02" goAdd={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Vorige dag' }))
    expect(setDay).toHaveBeenLastCalledWith('2024-04-30')
    await user.click(screen.getByRole('button', { name: 'Volgende dag' }))
    expect(setDay).toHaveBeenLastCalledWith('2024-05-02')
  })
  it('zet de volgende-dag-knop uit op vandaag', () => {
    render(<Today day="2024-05-02" setDay={vi.fn()} todayKey="2024-05-02" goAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Volgende dag' })).toBeDisabled()
  })
  it('voegt een fles water toe aan de dag', async () => {
    renderToday()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '＋ fles' }))
    await waitFor(async () => expect(await db.water.where('dayKey').equals(DAY).count()).toBe(1))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ text: 'Fles leeg (500 ml)' }))
  })
  it('verplaatst een item naar de volgende dag', async () => {
    await db.entries.add(entry('Havermout', 50))
    renderToday()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Havermout'))
    await user.click(screen.getByRole('button', { name: 'Volgende dag →' }))
    await waitFor(async () => expect((await db.entries.toArray())[0].dayKey).toBe('2024-05-02'))
  })
})
