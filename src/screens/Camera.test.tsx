import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Camera } from './Camera'

function stubMedia(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(getUserMedia) },
    configurable: true,
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

describe('Camera', () => {
  it('toont een video wanneer de camera beschikbaar is', async () => {
    stubMedia(() => Promise.resolve({ getTracks: () => [] }))
    const { container } = render(<Camera onShot={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    expect(container.querySelector('video')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '📸 Maak foto' })).toBeInTheDocument()
  })

  it('toont een foutmelding en geen foto-knop zonder toegang', async () => {
    stubMedia(() => Promise.reject(new Error('denied')))
    render(<Camera onShot={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText(/Geen toegang tot de camera/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '📸 Maak foto' })).not.toBeInTheDocument()
  })

  it('roept onClose aan bij Annuleren', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    stubMedia(() => Promise.reject(new Error('denied')))
    render(<Camera onShot={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('roept onShot niet aan als de video nog geen beeld heeft', async () => {
    const user = userEvent.setup()
    const onShot = vi.fn()
    stubMedia(() => Promise.resolve({ getTracks: () => [] }))
    render(<Camera onShot={onShot} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '📸 Maak foto' }))
    expect(onShot).not.toHaveBeenCalled()
  })

  it('stopt de tracks bij unmount', async () => {
    const stop = vi.fn()
    stubMedia(() => Promise.resolve({ getTracks: () => [{ stop }] }))
    const { unmount } = render(<Camera onShot={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    unmount()
    expect(stop).toHaveBeenCalled()
  })
})
