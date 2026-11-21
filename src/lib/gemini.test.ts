import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL, imageToBase64, labelToPer100, readLabel, readScale, scaleToGrams } from './gemini'

const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
const fail = (status: number, body = '') => new Response(body, { status })
const mockFetch = (res: Response) => {
  const fn = vi.fn(async () => res)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('readLabel', () => {
  it('stuurt sleutel, model en foto mee en geeft het JSON-antwoord terug', async () => {
    const fn = mockFetch(ok('{"name":"Kaas","perAmount":100,"kcal":350,"protein":25,"carbs":1,"fat":28}'))
    const r = await readLabel('KEY', 'm1', 'IMG')
    expect(r.kcal).toBe(350)
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/models/m1:generateContent')
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'KEY' })
    expect(String(init.body)).toContain('"data":"IMG"')
  })

  it.each([
    [429, /limiet/],
    [400, /weigert de sleutel/],
    [403, /weigert de sleutel/],
    [404, /bestaat niet/],
    [500, /Gemini fout 500: boem/],
  ])('vertaalt HTTP %i naar een melding', async (status, msg) => {
    mockFetch(fail(status, 'boem'))
    await expect(readLabel('k', 'm', 'i')).rejects.toThrow(msg)
  })

  it('meldt een leeg antwoord', async () => {
    mockFetch(new Response('{}'))
    await expect(readLabel('k', 'm', 'i')).rejects.toThrow('Gemini gaf geen antwoord')
  })

  it('geeft een fout bij tekst die geen JSON is', async () => {
    mockFetch(ok('geen json'))
    await expect(readLabel('k', 'm', 'i')).rejects.toBeInstanceOf(SyntaxError)
  })
})

describe('readScale', () => {
  it('geeft waarde en eenheid terug', async () => {
    mockFetch(ok('{"value":1.2,"unit":"kg"}'))
    expect(await readScale('k', 'm', 'i')).toEqual({ value: 1.2, unit: 'kg' })
  })
})

describe('labelToPer100', () => {
  it('rekent een tabel per 50 om naar per 100', () => {
    const r = { name: null, perAmount: 50, kcal: 100, protein: 5, carbs: null, fat: 2.5 }
    expect(labelToPer100(r)).toEqual({ kcal: 200, protein: 10, carbs: null, fat: 5 })
  })

  it('laat waarden ongemoeid als perAmount ontbreekt of 0 is', () => {
    const base = { name: null, kcal: 100, protein: 5, carbs: 1, fat: 1 }
    expect(labelToPer100({ ...base, perAmount: null }).kcal).toBe(100)
    expect(labelToPer100({ ...base, perAmount: 0 }).protein).toBe(5)
  })
})

describe('scaleToGrams', () => {
  it('rekent eenheden om naar gram', () => {
    expect(scaleToGrams({ value: 1.5, unit: 'kg' })).toBe(1500)
    expect(scaleToGrams({ value: 2, unit: 'oz' })).toBe(56.7)
    expect(scaleToGrams({ value: 1, unit: 'lb' })).toBe(453.6)
    expect(scaleToGrams({ value: 250, unit: null })).toBe(250)
  })

  it('geeft null zonder waarde', () => {
    expect(scaleToGrams({ value: null, unit: 'g' })).toBeNull()
  })
})

describe('imageToBase64', () => {
  it('verkleint naar maxSide en geeft alleen de base64-data terug', async () => {
    const drawImage = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: () => 'data:image/jpeg;base64,ABC' }
    vi.stubGlobal('createImageBitmap', async () => ({ width: 3200, height: 1600 }))
    vi.stubGlobal('document', { createElement: () => canvas })
    expect(await imageToBase64(new Blob(['x']))).toBe('ABC')
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(800)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800)
  })

  it('vergroot kleine foto’s niet', async () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL: () => 'data:x,Z' }
    vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600 }))
    vi.stubGlobal('document', { createElement: () => canvas })
    expect(await imageToBase64(new Blob(['x']))).toBe('Z')
    expect([canvas.width, canvas.height]).toEqual([800, 600])
  })
})

it('heeft het standaardmodel', () => {
  expect(DEFAULT_MODEL).toBe('gemini-flash-latest')
})
