import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { download, importJson } from '../lib/backup'
import { parseTime } from '../lib/day'
import Settings from './Settings'

vi.mock('../lib/backup', () => ({
  download: vi.fn(),
  exportCsv: vi.fn(async () => 'csv'),
  exportJson: vi.fn(async () => '{}'),
  importJson: vi.fn(async () => {}),
}))

const stored = async (key: string) => (await db.settings.get(key))?.value

beforeEach(async () => {
  await db.settings.clear()
  vi.clearAllMocks()
})
afterAll(() => db.close())

describe('Settings', () => {
  it('toont de opgeslagen sleutel en model', async () => {
    await db.settings.bulkPut([{ key: 'geminiKey', value: 'abc' }, { key: 'geminiModel', value: 'm-1' }])
    render(<Settings />)
    expect(await screen.findByDisplayValue('abc')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Model')).toHaveValue('m-1')
  })
  it('slaat een gewijzigde API-sleutel op', async () => {
    render(<Settings />)
    fireEvent.change(screen.getByPlaceholderText('API-sleutel'), { target: { value: 'xyz' } })
    await waitFor(async () => expect(await stored('geminiKey')).toBe('xyz'))
  })
  it('slaat de dagstart op', async () => {
    const { container } = render(<Settings />)
    // De component slaat de dagstart op bij onChange (change-event), niet bij blur.
    // 06:30 wijkt af van de standaard (04:00), zodat er een change-event komt.
    fireEvent.change(container.querySelector('input[type="time"]')!, { target: { value: '06:30' } })
    // Wacht op de database: de schrijfactie is asynchroon (Dexie/fake-indexeddb).
    await waitFor(async () => expect(await stored('dayStart')).toBe(parseTime('06:30')), { timeout: 3000 })
  })
  it('slaat de flesgrootte op', async () => {
    render(<Settings />)
    fireEvent.change(screen.getByLabelText('Fles (ml)'), { target: { value: '750' } })
    await waitFor(async () => expect(await stored('bottleMl')).toBe(750))
  })
  it('exporteert de CSV via download', async () => {
    render(<Settings />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Exporteer CSV' }))
    await waitFor(() => expect(download).toHaveBeenCalledWith('afvalapp-dagboek.csv', 'csv', 'text/csv'))
  })
  it('zet een back-up alleen terug na bevestiging', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = render(<Settings />)
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['{}'], 'b.json')] } })
    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(importJson).not.toHaveBeenCalled()
  })
})
