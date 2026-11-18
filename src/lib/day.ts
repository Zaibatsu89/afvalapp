/** Dagstart in minuten na middernacht (bv. 04:00 = 240). */
export type DayStart = number

export function parseTime(hhmm: string): DayStart {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatTime(min: DayStart): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`
}

/**
 * Logische dag (YYYY-MM-DD) van een tijdstip. Werkt op lokale klokttijd, dus
 * correct rond zomer-/wintertijd: vóór de dagstart hoort bij de vorige dag.
 */
export function dayKeyFor(ts: number, dayStart: DayStart): string {
  const d = new Date(ts)
  const minutes = d.getHours() * 60 + d.getMinutes()
  if (minutes >= dayStart) return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  return ymd(prev.getFullYear(), prev.getMonth() + 1, prev.getDate())
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const n = new Date(y, m - 1, d + delta)
  return ymd(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

export function formatDayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return 'Vandaag'
  if (key === shiftDay(todayKey, -1)) return 'Gisteren'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
