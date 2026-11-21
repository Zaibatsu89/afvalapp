import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readScale, scaleToGrams } from '../lib/gemini'
import { WeighButton } from './WeighButton'

// Instellingen worden synchroon uit deze map gelezen, zodat er geen wachttijd nodig is.
const settings = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('../lib/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/hooks')>()),
  useSetting: <T,>(key: string, fallback: T): T => (key in settings ? (settings[key] as T) : fallback),
}))
vi.mock('./Camera', () => ({
  Camera: ({ onShot }: { onShot: (b: Blob) => void }) => <button onClick={() => onShot(new Blob())}>foto</button>,
}))
vi.mock('../lib/gemini', () => ({
  DEFAULT_MODEL: 'model-x',
  imageToBase64: vi.fn(async () => 'b64'),
  readScale: vi.fn(),
  scaleToGrams: vi.fn(),
}))

beforeEach(() => {
  for (const k of Object.keys(settings)) delete settings[k]
  vi.clearAllMocks()
})

function shoot(onGrams = vi.fn()) {
  render(<WeighButton onGrams={onGrams} />)
  fireEvent.click(screen.getByRole('button', { name: '📷 Weeg' }))
  fireEvent.click(screen.getByRole('button', { name: 'foto' }))
  return onGrams
}

function withKey() {
  settings.geminiKey = 'k'
}

describe('WeighButton', () => {
  it('vraagt om een Gemini-sleutel als die ontbreekt', async () => {
    await shoot()
    expect(await screen.findByText(/Vul eerst je Gemini-sleutel/)).toBeInTheDocument()
    expect(readScale).not.toHaveBeenCalled()
  })

  it('toont de uitkomst en geeft die door na bevestigen', async () => {
    await withKey()
    vi.mocked(readScale).mockResolvedValue({ value: 812, unit: 'g' })
    vi.mocked(scaleToGrams).mockReturnValue(812)
    const onGrams = await shoot()
    expect(await screen.findByDisplayValue('812')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Klopt' }))
    expect(onGrams).toHaveBeenCalledWith(812)
    expect(screen.queryByDisplayValue('812')).not.toBeInTheDocument()
  })

  it('meldt als het getal niet gelezen kan worden', async () => {
    await withKey()
    vi.mocked(readScale).mockResolvedValue({ value: null, unit: null })
    vi.mocked(scaleToGrams).mockReturnValue(null)
    await shoot()
    expect(await screen.findByText(/Kon het getal niet lezen/)).toBeInTheDocument()
  })

  it('toont de foutmelding van een mislukte API-aanroep', async () => {
    await withKey()
    vi.mocked(readScale).mockRejectedValue(new Error('netwerk weg'))
    await shoot()
    expect(await screen.findByText('netwerk weg')).toBeInTheDocument()
  })
})
