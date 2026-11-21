import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./screens/Today', () => ({
  default: ({ goAdd }: { goAdd: () => void }) => <button onClick={() => goAdd()}>mock-today</button>,
}))
vi.mock('./screens/AddFood', () => ({
  default: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>mock-add</button>,
}))
vi.mock('./screens/Weight', () => ({ default: () => <p>mock-weight</p> }))
vi.mock('./screens/Settings', () => ({ default: () => <p>mock-settings</p> }))

describe('App-navigatie', () => {
  it('wisselt tussen de tabs', async () => {
    render(<App />)
    expect(await screen.findByText('mock-today')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Gewicht/ }))
    expect(screen.getByText('mock-weight')).toBeVisible()
    expect(screen.getByText('mock-today')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Instellingen/ }))
    expect(await screen.findByText('mock-settings')).toBeVisible()
    expect(screen.getByText('mock-weight')).not.toBeVisible()
  })

  it('opent het toevoegscherm en gaat terug naar vandaag', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('mock-today'))
    expect(await screen.findByText('mock-add')).toBeVisible()
    expect(screen.getByText('mock-today')).not.toBeVisible()
    fireEvent.click(screen.getByText('mock-add'))
    await waitFor(() => expect(screen.getByText('mock-today')).toBeVisible())
    expect(screen.getByText('mock-add')).not.toBeVisible()
  })
})
