import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { dayKeyFor, parseTime } from './day'

export const DEFAULT_DAY_START = parseTime('04:00')

export function useSetting<T>(key: string, fallback: T): T {
  return useLiveQuery(async () => ((await db.settings.get(key))?.value as T) ?? fallback, [key], fallback) as T
}

/** Huidige logische dag; ververst elke minuut en bij wijziging van de dagstart. */
export function useTodayKey(): string {
  const start = useSetting<number>('dayStart', DEFAULT_DAY_START)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return dayKeyFor(now, start)
}
