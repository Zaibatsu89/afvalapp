import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '../db'
import { dayKeyFor } from './day'
import { DEFAULT_DAY_START, useSetting, useTodayKey } from './hooks'

beforeEach(async () => {
  await db.settings.clear()
})

afterAll(() => {
  db.close()
})

describe('useSetting', () => {
  it('geeft de fallback zolang er geen instelling is', () => {
    const { result } = renderHook(() => useSetting('theme', 'licht'))
    expect(result.current).toBe('licht')
  })

  it('geeft de opgeslagen waarde', async () => {
    await db.settings.put({ key: 'theme', value: 'donker' })
    const { result } = renderHook(() => useSetting('theme', 'licht'))
    await waitFor(() => expect(result.current).toBe('donker'))
  })

  it('ververst na een wijziging in de database', async () => {
    const { result } = renderHook(() => useSetting('theme', 'licht'))
    await db.settings.put({ key: 'theme', value: 'donker' })
    await waitFor(() => expect(result.current).toBe('donker'))
  })
})

describe('useTodayKey', () => {
  it('gebruikt de standaard dagstart zonder instelling', () => {
    const { result } = renderHook(() => useTodayKey())
    expect(result.current).toBe(dayKeyFor(Date.now(), DEFAULT_DAY_START))
  })

  it('gebruikt de opgeslagen dagstart', async () => {
    await db.settings.put({ key: 'dayStart', value: 0 })
    const { result } = renderHook(() => useTodayKey())
    await waitFor(() => expect(result.current).toBe(dayKeyFor(Date.now(), 0)))
  })
})
