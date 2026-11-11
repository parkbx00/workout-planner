import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  backupFileName,
  BackupFormatError,
  exportBackup,
  exportCsv,
  importBackup,
  isBackupDue,
  parseBackup,
  serializeBackup,
  summarize,
  type Backup,
} from './backup.ts'
import { db, SCHEMA_VERSION } from './db.ts'
import { createExercise, setExerciseArchived } from './exercises.ts'
import { ensureSeeded } from './seed.ts'
import {
  addSessionExercise,
  finishSession,
  loadWorkout,
  setCompleted,
  startSession,
  swapSessionExercise,
  updateSession,
  updateSet,
} from './sessions.ts'
import {
  getDefaultRestSeconds,
  getIncrementDefaults,
  getLastBackupAt,
  getUnit,
  setDefaultRestSeconds,
  setIncrementDefault,
  setLastBackupAt,
  setUnit,
} from './settings.ts'
import {
  addTemplateExercise,
  createTemplate,
  deleteTemplate,
  updateTemplateExercise,
} from './templates.ts'

const DAY = 24 * 60 * 60 * 1000
const tick = () => new Promise((r) => setTimeout(r, 2))
const exerciseId = async (name: string) =>
  (await db.exercises.where('name').equals(name).first())!.id
const templateFor = async (day: number) =>
  (await db.templates.where('dayOfWeek').equals(day).first())!.id

async function logAll(sessionId: string, weight: number, reps: number, cards: number) {
  const workout = (await loadWorkout(sessionId))!
  for (const { sets } of workout.cards.slice(0, cards)) {
    for (const s of sets) {
      await updateSet(s.id, { weight, reps })
      await setCompleted(s.id, true)
      await tick()
    }
  }
}

/** A database that has been used the way the app is really used. */
async function buildUsedDatabase() {
  await ensureSeeded()

  const custom = await createExercise({
    name: 'Cable "Y" Raise, single-arm',
    muscleGroup: 'shoulders',
    equipment: 'cable',
    incrementLb: 2.5,
    incrementKg: 1.25,
  })
  await setExerciseArchived(await exerciseId('Hip Abduction Machine'), true)

  await deleteTemplate(await templateFor(3))
  const extra = await createTemplate('Arms')
  const row = await addTemplateExercise(extra.id, custom.id)
  await updateTemplateExercise(row.id, { targetSets: 4, repMin: 10, repMax: 15, restSeconds: 60 })

  // Finished workout in lb, with notes and a mid-workout swap and addition.
  const legs = await startSession(await templateFor(2))
  await addSessionExercise(legs.id, custom.id)
  const first = (await loadWorkout(legs.id))!.cards[0]
  await swapSessionExercise(first.card.id, await exerciseId('Hack Squat Machine'), false)
  await logAll(legs.id, 180, 9, 3)
  await updateSession(legs.id, { notes: 'Felt strong.\nKnee fine, "no" pain', startedAt: 1_780_000_000_000 })
  await finishSession(legs.id)

  // Finished workout entered in kg.
  await setUnit('kg')
  const chest = await startSession(await templateFor(1))
  await logAll(chest.id, 42.5, 12, 2)
  await finishSession(chest.id)

  await setDefaultRestSeconds(75)
  await setIncrementDefault('lower', 'lb', 20)

  // Workout still in progress, with unchecked sets.
  const open = await startSession(null)
  await addSessionExercise(open.id, custom.id)
  const [openSet] = (await loadWorkout(open.id))!.cards[0].sets
  await updateSet(openSet.id, { weight: 7.5, reps: 15 })
  await setCompleted(openSet.id, true)
}

async function dump() {
  return {
    exercises: await db.exercises.toArray(),
    templates: await db.templates.toArray(),
    templateExercises: await db.templateExercises.toArray(),
    sessions: await db.sessions.toArray(),
    sessionExercises: await db.sessionExercises.toArray(),
    sets: await db.sets.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.key !== 'lastBackupAt'),
  }
}

async function wipe() {
  await db.delete()
  await db.open()
}

beforeEach(wipe)

describe('backup round-trip', () => {
  it('restores every record exactly after a wipe', async () => {
    await buildUsedDatabase()
    const before = await dump()
    const file = serializeBackup(await exportBackup())

    await wipe()
    expect(await db.sets.count()).toBe(0)

    await importBackup(parseBackup(file))
    const after = await dump()

    expect(after).toEqual(before)
    for (const rows of Object.values(before)) expect(rows.length).toBeGreaterThan(0)
  })

  it('produces a byte-identical file when the restored data is exported again', async () => {
    await buildUsedDatabase()
    const first = await exportBackup(1_800_000_000_000)
    await wipe()
    await importBackup(parseBackup(serializeBackup(first)))
    const second = await exportBackup(1_800_000_000_000)
    expect(serializeBackup(second)).toBe(serializeBackup(first))
  })

  it('survives a launch after restore without re-seeding or duplicating anything', async () => {
    await buildUsedDatabase()
    const before = await dump()
    const file = serializeBackup(await exportBackup())
    await wipe()
    // A fresh install seeds itself before the user gets to Import.
    await ensureSeeded()
    await importBackup(parseBackup(file))
    await ensureSeeded()
    expect(await dump()).toEqual(before)
  })

  it('keeps the app working on the restored data', async () => {
    await buildUsedDatabase()
    const file = serializeBackup(await exportBackup())
    await wipe()
    await importBackup(parseBackup(file))

    expect(await getUnit()).toBe('kg')
    expect(await getDefaultRestSeconds()).toBe(75)
    expect((await getIncrementDefaults()).lower.lb).toBe(20)

    // The second legs workout gets its suggestion from the restored first one.
    await setUnit('lb')
    const open = await db.sessions.filter((s) => s.endedAt === null).first()
    await finishSession(open!.id)
    const next = await startSession(await templateFor(2))
    const press = (await loadWorkout(next.id))!.cards.find((c) => c.exercise!.name === 'Leg Press')!
    expect(press.previous.map((s) => [s.weight, s.reps])).toEqual([
      [180, 9],
      [180, 9],
      [180, 9],
    ])
    expect(press.suggestion).not.toBeNull()
  })

  it('replaces what was on the device rather than merging', async () => {
    await ensureSeeded()
    const empty = await exportBackup()
    const session = await startSession(await templateFor(2))
    await logAll(session.id, 100, 10, 1)
    await finishSession(session.id)
    await createExercise({
      name: 'Later Exercise',
      muscleGroup: 'core',
      equipment: 'bodyweight',
      incrementLb: 5,
      incrementKg: 2.5,
    })

    await importBackup(parseBackup(serializeBackup(empty)))
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
    expect(await db.exercises.where('name').equals('Later Exercise').count()).toBe(0)
  })

  it('leaves existing data untouched when the import fails part-way', async () => {
    await buildUsedDatabase()
    const before = await dump()
    const backup = await exportBackup()
    // Passes parsing in memory, but a duplicate primary key makes the write fail.
    const broken: Backup = {
      ...backup,
      data: { ...backup.data, sets: [...backup.data.sets, backup.data.sets[0]] },
    }
    await expect(importBackup(broken)).rejects.toThrow()
    expect(await dump()).toEqual(before)
  })
})

describe('backup file', () => {
  it('carries the app marker, schema version and export time', async () => {
    await ensureSeeded()
    const backup = await exportBackup(1234)
    expect(backup).toMatchObject({ app: 'liftlog', version: SCHEMA_VERSION, exportedAt: 1234 })
    expect(JSON.parse(serializeBackup(backup)).version).toBe(SCHEMA_VERSION)
  })

  it('uses a dated filename', () => {
    expect(backupFileName('json', new Date(2026, 10, 10))).toBe('workouts-2026-11-10.json')
    expect(backupFileName('csv', new Date(2027, 0, 5))).toBe('workouts-2027-01-05.csv')
  })

  it('leaves the last-backup date out of the file and sets it on restore', async () => {
    await ensureSeeded()
    await setLastBackupAt(111)
    const backup = await exportBackup(999)
    expect(backup.data.settings.some((s) => s.key === 'lastBackupAt')).toBe(false)
    await wipe()
    await importBackup(backup)
    expect(await getLastBackupAt()).toBe(999)
  })

  it('summarizes what a backup holds', async () => {
    await buildUsedDatabase()
    const s = summarize((await exportBackup()).data)
    expect(s.workouts).toBe(2) // the in-progress one isn't counted
    expect(s.sets).toBe(9 + 6 + 1)
    expect(s.customExercises).toBe(1)
    expect(s.templates).toBe(3)
    expect(s.firstWorkoutAt).toBe(1_780_000_000_000)
    expect(s.lastWorkoutAt).toBeGreaterThan(s.firstWorkoutAt!)
  })
})

describe('parseBackup', () => {
  const valid = async () => {
    await buildUsedDatabase()
    return exportBackup()
  }
  const reject = (value: unknown, message: RegExp) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    expect(() => parseBackup(text)).toThrow(BackupFormatError)
    expect(() => parseBackup(text)).toThrow(message)
  }

  it('rejects files that are not Lift Log backups', () => {
    reject('not json {', /valid JSON/)
    reject('null', /isn't a Lift Log backup/)
    reject({ hello: 'world' }, /isn't a Lift Log backup/)
    reject({ app: 'other', version: 1, exportedAt: 1, data: {} }, /isn't a Lift Log backup/)
  })

  it('rejects a backup from a newer schema', async () => {
    reject({ ...(await valid()), version: SCHEMA_VERSION + 1 }, /newer version/)
  })

  it('rejects missing tables and malformed rows', async () => {
    const b = await valid()
    reject({ ...b, data: { ...b.data, sets: undefined } }, /missing its sets/)
    reject(
      { ...b, data: { ...b.data, sets: [{ ...b.data.sets[0], unit: 'stone' }] } },
      /sets entry 1 has a bad unit/,
    )
    reject(
      { ...b, data: { ...b.data, exercises: [...b.data.exercises, { id: 5 }] } },
      /exercises entry \d+ has a bad id/,
    )
    reject(
      { ...b, data: { ...b.data, sessions: [...b.data.sessions, b.data.sessions[0]] } },
      /duplicate/,
    )
  })

  it('rejects sets whose workout or exercise is not in the file', async () => {
    const b = await valid()
    reject({ ...b, data: { ...b.data, sessions: b.data.sessions.slice(1) } }, /missing/)
    reject({ ...b, data: { ...b.data, exercises: [] } }, /missing/)
  })

  it('accepts its own output', async () => {
    const b = await valid()
    expect(parseBackup(serializeBackup(b))).toEqual(b)
  })
})

describe('backup reminder', () => {
  const now = 2_000_000_000_000
  async function workoutAt(startedAt: number) {
    const s = await startSession(await templateFor(2))
    await logAll(s.id, 100, 10, 1)
    await updateSession(s.id, { startedAt })
    await finishSession(s.id)
  }

  it('stays quiet with nothing logged', async () => {
    await ensureSeeded()
    expect(await isBackupDue(now)).toBe(false)
  })

  it('appears once the first workout is over 7 days old and nothing was backed up', async () => {
    await ensureSeeded()
    await workoutAt(now - 6 * DAY)
    expect(await isBackupDue(now)).toBe(false)
    await workoutAt(now - 8 * DAY)
    expect(await isBackupDue(now)).toBe(true)
  })

  it('follows the last backup date', async () => {
    await ensureSeeded()
    await workoutAt(now - 30 * DAY)
    await setLastBackupAt(now - 7 * DAY + 1000)
    expect(await isBackupDue(now)).toBe(false)
    await setLastBackupAt(now - 7 * DAY - 1000)
    expect(await isBackupDue(now)).toBe(true)
  })
})

describe('CSV export', () => {
  it('writes a header and one row per checked-off set', async () => {
    await buildUsedDatabase()
    const lines = (await exportCsv()).trimEnd().split('\r\n')
    expect(lines[0]).toBe(
      'date,time,workout,exercise,muscle_group,equipment,set,weight,unit,reps,est_1rm,completed_at,workout_notes',
    )
    // Quoted notes contain a line break, so count records by their leading date instead.
    const csv = await exportCsv()
    expect(csv.match(/^\d{4}-\d{2}-\d{2},\d{2}:\d{2},/gm)).toHaveLength(9 + 6 + 1)
  })

  it('keeps each set in its entered unit, numbers sets per exercise and escapes text', async () => {
    await buildUsedDatabase()
    const csv = await exportCsv()
    expect(csv).toContain(',Hack Squat Machine,quads,machine,1,180,lb,9,234,')
    expect(csv).toContain(',Hack Squat Machine,quads,machine,3,180,lb,9,234,')
    expect(csv).toContain(',kg,12,')
    expect(csv).toContain('"Cable ""Y"" Raise, single-arm",shoulders,cable,1,7.5,kg,15,')
    expect(csv).toContain('"Felt strong.\nKnee fine, ""no"" pain"')
    expect(csv.indexOf('Hack Squat Machine')).toBeLessThan(csv.indexOf(',kg,12,'))
  })

  it('is only a header when nothing is logged', async () => {
    await ensureSeeded()
    expect((await exportCsv()).trimEnd().split('\r\n')).toHaveLength(1)
  })
})

describe('settings', () => {
  it('defaults to lb, 90 s rest and 5/10 lb, 2.5/5 kg increments', async () => {
    expect(await getUnit()).toBe('lb')
    expect(await getDefaultRestSeconds()).toBe(90)
    expect(await getIncrementDefaults()).toEqual({
      upper: { lb: 5, kg: 2.5 },
      lower: { lb: 10, kg: 5 },
    })
  })

  it('uses the default rest time for exercises added to a template or a workout', async () => {
    await ensureSeeded()
    await setDefaultRestSeconds(120)
    const t = await createTemplate('T')
    const row = await addTemplateExercise(t.id, await exerciseId('Leg Press'))
    expect(row.restSeconds).toBe(120)
    const s = await startSession(null)
    await addSessionExercise(s.id, await exerciseId('Leg Press'))
    expect((await loadWorkout(s.id))!.cards[0].card.restSeconds).toBe(120)
    await setDefaultRestSeconds(9999)
    expect(await getDefaultRestSeconds()).toBe(600)
  })

  it('moves exercises on the old default increment and leaves customised ones alone', async () => {
    await ensureSeeded()
    const press = await exerciseId('Leg Press')
    const squat = await exerciseId('Smith Squat')
    await db.exercises.update(squat, { incrementLb: 2.5 })

    const changed = await setIncrementDefault('lower', 'lb', 20)
    expect(changed).toBeGreaterThan(5)
    expect((await db.exercises.get(press))!.incrementLb).toBe(20)
    expect((await db.exercises.get(press))!.incrementKg).toBe(5)
    expect((await db.exercises.get(squat))!.incrementLb).toBe(2.5)
    const upper = await db.exercises.where('muscleGroup').equals('chest').first()
    expect(upper!.incrementLb).toBe(5)
    await expect(setIncrementDefault('upper', 'kg', 0)).rejects.toThrow(RangeError)
  })
})
