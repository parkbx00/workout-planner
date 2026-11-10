import { describe, expect, it } from 'vitest'
import { describeSuggestion, suggest, type PastSession } from './progression.ts'

/** A past session at one weight with the given reps, logged against an 8–12 range unless stated. */
const session = (weight: number | null, reps: number[], repMin = 8, repMax = 12): PastSession => ({
  sets: reps.map((r) => ({ weight, reps: r })),
  repMin,
  repMax,
})
const run = (history: PastSession[], over: Partial<Parameters<typeof suggest>[0]> = {}) =>
  suggest({ history, increment: 5, repMin: 8, repMax: 12, targetSets: 3, ...over })

describe('rule 4: no history', () => {
  it('gives no suggestion', () => {
    expect(run([])).toBeNull()
    expect(run([{ sets: [], repMin: 8, repMax: 12 }])).toBeNull()
  })
})

describe('rule 1: every set reached repMax', () => {
  it('adds the increment and resets to repMin', () => {
    expect(run([session(135, [12, 12, 12])])).toEqual({ kind: 'increase', weight: 140, reps: [8, 8, 8] })
  })

  it('counts reps above repMax as reaching it', () => {
    expect(run([session(135, [14, 12, 13])])).toMatchObject({ kind: 'increase', weight: 140 })
  })

  it('uses the exercise increment (10 lb lower body, 2.5 kg)', () => {
    expect(run([session(200, [12, 12, 12])], { increment: 10 })).toMatchObject({ weight: 210 })
    expect(run([session(60, [12, 12, 12])], { increment: 2.5 })).toMatchObject({ weight: 62.5 })
  })

  it("targets today's rep range and set count", () => {
    const s = run([session(135, [12, 12, 12])], { repMin: 10, repMax: 15, targetSets: 4 })
    expect(s).toEqual({ kind: 'increase', weight: 140, reps: [10, 10, 10, 10] })
  })
})

describe('rule 2: every set within the range', () => {
  it('keeps the weight and adds a rep to the set with the fewest reps', () => {
    expect(run([session(135, [10, 9, 8])])).toEqual({ kind: 'add-rep', weight: 135, reps: [10, 9, 9] })
  })

  it('adds the rep to the first of several equally low sets', () => {
    expect(run([session(135, [10, 10, 10])])).toEqual({ kind: 'add-rep', weight: 135, reps: [11, 10, 10] })
  })

  it('treats "some sets at repMax, others not" as still in range', () => {
    expect(run([session(135, [12, 12, 11])])).toEqual({ kind: 'add-rep', weight: 135, reps: [12, 12, 12] })
  })

  it('fills extra target sets from the last logged set', () => {
    expect(run([session(135, [10, 9])], { targetSets: 4 })).toEqual({
      kind: 'add-rep',
      weight: 135,
      reps: [10, 10, 9, 9],
    })
  })
})

describe('rule 3: a set fell below repMin', () => {
  it('repeats the weight after one tough session, aiming for at least repMin', () => {
    expect(run([session(135, [9, 7, 6])])).toEqual({ kind: 'repeat', weight: 135, reps: [9, 8, 8] })
  })

  it('repeats (no deload) when the session before was fine', () => {
    expect(run([session(135, [8, 7, 6]), session(130, [12, 12, 12])])).toMatchObject({
      kind: 'repeat',
      weight: 135,
    })
  })

  it('drops 10% after two tough sessions in a row, rounded to the nearest increment', () => {
    // 135 × 0.9 = 121.5 → nearest 5 = 120
    expect(run([session(135, [8, 7, 6]), session(135, [9, 7, 7])])).toEqual({
      kind: 'deload',
      weight: 120,
      reps: [8, 8, 8],
    })
    // 200 × 0.9 = 180 with a 10 lb increment
    expect(run([session(200, [7, 6, 6]), session(200, [7, 7, 6])], { increment: 10 })).toMatchObject({
      kind: 'deload',
      weight: 180,
    })
    // 62.5 kg × 0.9 = 56.25 → nearest 2.5 = 57.5 (56.25 is exactly halfway and rounds up)
    expect(run([session(62.5, [6, 6, 6]), session(62.5, [7, 6, 6])], { increment: 2.5 })).toMatchObject({
      weight: 57.5,
    })
  })

  it('always goes down by at least one increment when deloading a light weight', () => {
    // 10 × 0.9 = 9 → nearest 5 is 10, which is no lighter, so drop one increment instead
    expect(run([session(10, [6, 6, 6]), session(10, [6, 6, 6])])).toMatchObject({ kind: 'deload', weight: 5 })
  })

  it('only looks at the two most recent sessions', () => {
    const history = [session(135, [12, 10, 9]), session(135, [7, 7, 6]), session(135, [7, 6, 6])]
    expect(run(history)).toMatchObject({ kind: 'add-rep', weight: 135 })
  })
})

describe('working sets', () => {
  it('judges only the sets at the heaviest weight of the day', () => {
    const mixed: PastSession = {
      sets: [
        { weight: 95, reps: 15 }, // warm-up
        { weight: 135, reps: 12 },
        { weight: 135, reps: 12 },
        { weight: 115, reps: 6 }, // back-off set
      ],
      repMin: 8,
      repMax: 12,
    }
    expect(run([mixed])).toEqual({ kind: 'increase', weight: 140, reps: [8, 8, 8] })
  })

  it('judges each past session against the range it was logged with', () => {
    // 3 × 10 against an old 6–10 range hit the top, even though today's card says 8–12
    expect(run([session(135, [10, 10, 10], 6, 10)])).toEqual({ kind: 'increase', weight: 140, reps: [8, 8, 8] })
  })
})

describe('bodyweight (no weight)', () => {
  it('progresses by reps only, even past repMax', () => {
    expect(run([session(null, [12, 12, 12])])).toEqual({ kind: 'add-rep', weight: null, reps: [13, 12, 12] })
    expect(run([session(null, [10, 9, 8])])).toEqual({ kind: 'add-rep', weight: null, reps: [10, 9, 9] })
  })

  it('never deloads', () => {
    expect(run([session(null, [6, 5, 5]), session(null, [6, 6, 5])])).toEqual({
      kind: 'repeat',
      weight: null,
      reps: [8, 8, 8],
    })
  })
})

describe('describeSuggestion', () => {
  it('writes a short line for the exercise card', () => {
    expect(describeSuggestion({ kind: 'increase', weight: 140, reps: [8, 8, 8] }, 'lb')).toBe('140 lb × 8 · weight up')
    expect(describeSuggestion({ kind: 'add-rep', weight: 62.5, reps: [10, 10, 9] }, 'kg')).toBe(
      '62.5 kg × 10, 10, 9 · add a rep',
    )
    expect(describeSuggestion({ kind: 'add-rep', weight: null, reps: [13, 12, 12] }, 'lb')).toBe(
      '13, 12, 12 reps · add a rep',
    )
    expect(describeSuggestion({ kind: 'deload', weight: 120, reps: [8, 8, 8] }, 'lb')).toBe(
      '120 lb × 8 · 10% lighter after two tough sessions',
    )
  })
})
