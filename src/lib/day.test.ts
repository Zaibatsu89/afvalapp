import { describe, expect, it } from 'vitest'
import { dayKeyFor, formatDayLabel, formatTime, parseTime, shiftDay } from './day'

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()

describe('parseTime', () => {
  it('zet HH:MM om naar minuten na middernacht', () => {
    expect(parseTime('04:00')).toBe(240)
    expect(parseTime('00:00')).toBe(0)
    expect(parseTime('23:59')).toBe(1439)
    expect(parseTime('06:30')).toBe(390)
  })
  it('accepteert één cijfer per onderdeel', () => {
    expect(parseTime('4:5')).toBe(245)
  })
})

describe('formatTime', () => {
  it('formatteert minuten als HH:MM met voorloopnullen', () => {
    expect(formatTime(240)).toBe('04:00')
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(1439)).toBe('23:59')
    expect(formatTime(65)).toBe('01:05')
  })
  it('is de omgekeerde van parseTime', () => {
    for (const t of ['00:00', '04:00', '12:34', '23:59']) {
      expect(formatTime(parseTime(t))).toBe(t)
    }
  })
})

describe('dayKeyFor', () => {
  it('vóór de dagstart hoort het bij de vorige dag', () => {
    expect(dayKeyFor(at(2026, 11, 19, 0, 30), 240)).toBe('2026-11-18')
    expect(dayKeyFor(at(2026, 11, 19, 3, 59), 240)).toBe('2026-11-18')
  })
  it('precies op de dagstart begint de nieuwe dag', () => {
    expect(dayKeyFor(at(2026, 11, 19, 4, 0), 240)).toBe('2026-11-19')
    expect(dayKeyFor(at(2026, 11, 19, 4, 1), 240)).toBe('2026-11-19')
  })
  it('dagstart om middernacht: 00:00 hoort al bij de nieuwe dag', () => {
    expect(dayKeyFor(at(2026, 11, 19, 0, 0), 0)).toBe('2026-11-19')
    expect(dayKeyFor(at(2026, 11, 19, 23, 59), 0)).toBe('2026-11-19')
  })
  it('dagstart om 23:59: alles tot dan hoort bij de vorige dag', () => {
    expect(dayKeyFor(at(2026, 11, 19, 23, 58), 1439)).toBe('2026-11-18')
    expect(dayKeyFor(at(2026, 11, 19, 23, 59), 1439)).toBe('2026-11-19')
  })
  it('aangepaste dagstart (06:00)', () => {
    expect(dayKeyFor(at(2026, 11, 19, 5, 59), parseTime('06:00'))).toBe('2026-11-18')
    expect(dayKeyFor(at(2026, 11, 19, 6, 0), parseTime('06:00'))).toBe('2026-11-19')
  })
  it('overdag met dagstart 12:00', () => {
    expect(dayKeyFor(at(2026, 11, 19, 11, 59), 720)).toBe('2026-11-18')
    expect(dayKeyFor(at(2026, 11, 19, 12, 0), 720)).toBe('2026-11-19')
  })
  it('maandgrens: 1 januari 02:00 hoort bij 31 december', () => {
    expect(dayKeyFor(at(2027, 1, 1, 2), 240)).toBe('2026-12-31')
  })
  it('maartgrens: 1 maart 01:00 in een niet-schrikkeljaar hoort bij 28 februari', () => {
    expect(dayKeyFor(at(2026, 3, 1, 1), 240)).toBe('2026-02-28')
  })
  it('maartgrens in een schrikkeljaar hoort bij 29 februari', () => {
    expect(dayKeyFor(at(2028, 3, 1, 1), 240)).toBe('2028-02-29')
  })
  it('zomertijd-overgang (29 maart 2026)', () => {
    expect(dayKeyFor(at(2026, 3, 29, 3, 30), 240)).toBe('2026-03-28')
    expect(dayKeyFor(at(2026, 3, 29, 4, 0), 240)).toBe('2026-03-29')
  })
  it('een uur later na de dagstart geeft een andere dagsleutel', () => {
    const t = at(2026, 11, 19, 3, 0)
    expect(dayKeyFor(t, 240)).toBe('2026-11-18')
    expect(dayKeyFor(t + 60 * 60 * 1000, 240)).toBe('2026-11-19')
  })
})

describe('shiftDay', () => {
  it('één dag terug over een maandgrens', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('één dag vooruit over een jaargrens', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('één dag terug over een jaargrens', () => {
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('schrikkeldag 2028 en niet-schrikkeljaar 2026', () => {
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('meerdere dagen vooruit over een maandgrens', () => {
    expect(shiftDay('2026-02-27', 3)).toBe('2026-03-02')
  })
  it('delta 0 geeft dezelfde sleutel terug', () => {
    expect(shiftDay('2026-11-19', 0)).toBe('2026-11-19')
  })
  it('behoudt voorloopnullen in maand en dag', () => {
    expect(shiftDay('2026-01-09', 1)).toBe('2026-01-10')
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30')
  })
  it('grote delta over een jaar', () => {
    expect(shiftDay('2026-11-19', 365)).toBe('2027-11-19')
  })
})

describe('formatDayLabel', () => {
  it('dezelfde dag als vandaag is "Vandaag"', () => {
    expect(formatDayLabel('2026-11-19', '2026-11-19')).toBe('Vandaag')
  })
  it('de dag ervoor is "Gisteren"', () => {
    expect(formatDayLabel('2026-11-18', '2026-11-19')).toBe('Gisteren')
  })
  it('"Gisteren" werkt over een jaargrens', () => {
    expect(formatDayLabel('2026-12-31', '2027-01-01')).toBe('Gisteren')
  })
  it('twee dagen terug is geen "Gisteren" maar een datumlabel', () => {
    const label = formatDayLabel('2026-11-17', '2026-11-19')
    expect(label).not.toBe('Gisteren')
    expect(label).not.toBe('Vandaag')
    expect(label).toMatch(/17 november/)
  })
  it('toekomstige dag (morgen) krijgt een datumlabel, geen "Vandaag"', () => {
    const label = formatDayLabel('2026-11-20', '2026-11-19')
    expect(label).not.toBe('Vandaag')
    expect(label).not.toBe('Gisteren')
    expect(label).toMatch(/vrijdag/)
    expect(label).toMatch(/20 november/)
  })
  it('datumlabel is Nederlands en bevat weekdag, dag en maand', () => {
    // 19 november 2026 is een donderdag.
    const label = formatDayLabel('2026-11-10', '2026-11-19')
    expect(label).toMatch(/dinsdag/)
    expect(label).toMatch(/10 november/)
  })
})
