import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, formatWeight } from './format.ts'
import { remainingMs, restTimer } from './restTimer.ts'
import { bestSet, epley1RM, totalVolume } from './stats.ts'
import { convertWeight } from './units.ts'

describe('units', () => {
  it('converts with 1 kg = 2.20462 lb, rounded to the nearest 0.5', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBe(220.5)
    expect(convertWeight(135, 'lb', 'kg')).toBe(61)
    expect(convertWeight(137.5, 'lb', 'lb')).toBe(137.5)
  })
})

describe('stats', () => {
  const set = (weight: number | null, reps: number | null, unit: 'lb' | 'kg' = 'lb', completed = true) => ({
    weight,
    reps,
    unit,
    completed,
  })

  it('estimates 1RM with Epley', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley1RM(200, 3)).toBeCloseTo(220)
  })

  it('sums volume over completed sets only, in the requested unit', () => {
    const sets = [set(100, 10), set(100, 8), set(500, 5, 'lb', false), set(null, 12), set(50, 10, 'kg')]
    expect(totalVolume(sets, 'lb')).toBeCloseTo(1800 + 50 * 2.20462 * 10)
    expect(totalVolume([set(100, 10, 'kg')], 'kg')).toBeCloseTo(1000)
  })

  it('picks the best set by estimated 1RM across units', () => {
    const heavy = set(100, 5, 'kg') // ~257 lb e1RM
    expect(bestSet([set(200, 5), heavy, set(300, 1, 'lb', false)])!.set).toBe(heavy)
    expect(bestSet([set(null, 10), set(0, 10)])).toBeNull()
  })
})

describe('format', () => {
  it('formats clocks, durations and weights', () => {
    expect(formatClock(95)).toBe('1:35')
    expect(formatClock(0)).toBe('0:00')
    expect(formatDuration(42 * 60_000 + 10_000)).toBe('42:10')
    expect(formatDuration(3_725_000)).toBe('1:02:05')
    expect(formatWeight(135)).toBe('135')
    expect(formatWeight(62.5)).toBe('62.5')
  })
})

describe('rest timer', () => {
  const t0 = 1_000_000

  it('is based on the end timestamp, so time away from the app still counts', () => {
    restTimer.start(90, t0)
    const state = restTimer.getSnapshot()!
    expect(remainingMs(state, t0)).toBe(90_000)
    expect(remainingMs(state, t0 + 60_000)).toBe(30_000) // e.g. after a minute with the screen locked
    expect(remainingMs(state, t0 + 500_000)).toBe(0)
  })

  it('adjusts by ±15s without going below zero, and clears on skip', () => {
    restTimer.start(90, t0)
    restTimer.adjust(15, t0)
    expect(restTimer.getSnapshot()).toEqual({ endsAt: t0 + 105_000, totalSeconds: 105 })
    restTimer.adjust(-15, t0)
    restTimer.adjust(-15, t0 + 80_000) // only 10s left: clamps to "now"
    expect(remainingMs(restTimer.getSnapshot()!, t0 + 80_000)).toBe(0)
    restTimer.clear()
    expect(restTimer.getSnapshot()).toBeNull()
  })

  it('notifies subscribers', () => {
    let calls = 0
    const unsubscribe = restTimer.subscribe(() => calls++)
    restTimer.start(30, t0)
    restTimer.clear()
    unsubscribe()
    restTimer.start(30, t0)
    restTimer.clear()
    expect(calls).toBe(2)
  })
})
