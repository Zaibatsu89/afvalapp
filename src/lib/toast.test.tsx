import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './toast'

type T = { text: string; undo?: () => void | Promise<void> }

function Trigger({ label, t }: { label: string; t: T }) {
  const show = useToast()
  return <button onClick={() => show(t)}>{label}</button>
}

function setup(...triggers: [string, T][]) {
  render(
    <ToastProvider>
      {triggers.map(([label, t]) => (
        <Trigger key={label} label={label} t={t} />
      ))}
    </ToastProvider>,
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ToastProvider', () => {
  it('toont de tekst na show', () => {
    setup(['toon', { text: 'Opgeslagen' }])
    fireEvent.click(screen.getByRole('button', { name: 'toon' }))
    expect(screen.getByRole('status')).toHaveTextContent('Opgeslagen')
  })

  it('verbergt de melding na 6 seconden', () => {
    setup(['toon', { text: 'Opgeslagen' }])
    fireEvent.click(screen.getByRole('button', { name: 'toon' }))
    act(() => vi.advanceTimersByTime(5999))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('toont geen knop zonder undo', () => {
    setup(['toon', { text: 'Opgeslagen' }])
    fireEvent.click(screen.getByRole('button', { name: 'toon' }))
    expect(screen.queryByRole('button', { name: 'Ongedaan maken' })).not.toBeInTheDocument()
  })

  it('voert undo uit en verbergt de melding', async () => {
    const undo = vi.fn()
    setup(['toon', { text: 'Verwijderd', undo }])
    fireEvent.click(screen.getByRole('button', { name: 'toon' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ongedaan maken' }))
    })
    expect(undo).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('vervangt een open melding en herstart de timer', () => {
    setup(['a', { text: 'Eerste' }], ['b', { text: 'Tweede' }])
    fireEvent.click(screen.getByRole('button', { name: 'a' }))
    act(() => vi.advanceTimersByTime(4000))
    fireEvent.click(screen.getByRole('button', { name: 'b' }))
    expect(screen.getByRole('status')).toHaveTextContent('Tweede')
    act(() => vi.advanceTimersByTime(5999))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
