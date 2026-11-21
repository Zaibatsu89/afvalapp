import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { dayKeyFor } from '../lib/day'
import { DEFAULT_DAY_START } from '../lib/hooks'
import Weight from './Weight'

beforeEach(async () => {
  await db.weights.clear()
})

afterAll(() => {
  db.close()
})

describe('Weight', () => {
  it('toont geen grafiek zonder metingen en blokkeert opslaan', () => {
    render(<Weight />)
    expect(screen.queryByRole('img', { name: 'Gewichtsverloop' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opslaan' })).toBeDisabled()
  })

  it('keurt waarden buiten 20 tot 400 kg af', async () => {
    const user = userEvent.setup()
    render(<Weight />)
    await user.type(screen.getByPlaceholderText('kg'), '10')
    expect(screen.getByRole('button', { name: 'Opslaan' })).toBeDisabled()
  })

  it('slaat een komma-invoer op onder de huidige dagsleutel', async () => {
    const user = userEvent.setup()
    render(<Weight />)
    await user.type(screen.getByPlaceholderText('kg'), '81,5')
    await user.click(screen.getByRole('button', { name: 'Opslaan' }))
    await waitFor(() => expect(screen.getByPlaceholderText('kg')).toHaveValue(''))
    const row = await db.weights.get(dayKeyFor(Date.now(), DEFAULT_DAY_START))
    expect(row?.kg).toBe(81.5)
  })

  it('toont minimum en maximum van de metingen', async () => {
    await db.weights.bulkPut([
      { dayKey: '2024-01-01', kg: 80 },
      { dayKey: '2024-01-02', kg: 81.5 },
    ])
    render(<Weight />)
    const chart = await screen.findByRole('img', { name: 'Gewichtsverloop' })
    expect(within(chart).getByText('81.5 kg')).toBeInTheDocument()
    expect(within(chart).getByText('80 kg')).toBeInTheDocument()
  })

  it('verwijdert een meting via het kruisje', async () => {
    const user = userEvent.setup()
    await db.weights.put({ dayKey: '2024-01-01', kg: 80 })
    render(<Weight />)
    await user.click(await screen.findByRole('button', { name: '✕' }))
    await waitFor(() => expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument())
    expect(await db.weights.count()).toBe(0)
  })
})
