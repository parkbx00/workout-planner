import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import Sheet, { SheetButton } from '../components/Sheet.tsx'
import {
  BACKUP_STALE_MS,
  backupFileName,
  BackupFormatError,
  exportBackup,
  exportCsv,
  importBackup,
  parseBackup,
  serializeBackup,
  summarize,
  summarizeCurrent,
  type Backup,
  type DataSummary,
} from '../db/backup.ts'
import { getActiveSession } from '../db/sessions.ts'
import {
  getDefaultRestSeconds,
  getIncrementDefaults,
  getLastBackupAt,
  getUnit,
  REST_LIMITS,
  setDefaultRestSeconds,
  setIncrementDefault,
  setLastBackupAt,
  setUnit,
  type BodyHalf,
} from '../db/settings.ts'
import type { Unit } from '../db/types.ts'
import { formatClock } from '../lib/format.ts'
import { restTimer } from '../lib/restTimer.ts'
import { isStoragePersistent, saveFile } from '../lib/saveFile.ts'

type Notice = { tone: 'ok' | 'error'; text: string }
/** A file that is built and waiting for one more tap to open the share sheet. */
type Pending = { file: File; isBackup: boolean; exportedAt: number }

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

export default function Settings() {
  const settings = useLiveQuery(async () => {
    const [unit, rest, increments, lastBackupAt, active] = await Promise.all([
      getUnit(),
      getDefaultRestSeconds(),
      getIncrementDefaults(),
      getLastBackupAt(),
      getActiveSession(),
    ])
    const stale = lastBackupAt !== null && Date.now() - lastBackupAt > BACKUP_STALE_MS
    return { unit, rest, increments, lastBackupAt, stale, workoutActive: active !== undefined }
  }, [])

  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [preview, setPreview] = useState<{ backup: Backup; current: DataSummary } | null>(null)
  const [persistent, setPersistent] = useState<boolean | null>(null)

  useEffect(() => {
    void isStoragePersistent().then(setPersistent)
  }, [])

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)

  if (!settings) return <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

  async function deliver(p: Pending) {
    const result = await saveFile(p.file)
    if (result === 'needs-tap') {
      setPending(p)
      return
    }
    setPending(null)
    if (result === 'cancelled') {
      setNotice({ tone: 'error', text: `Nothing was saved: the share sheet was closed.` })
      return
    }
    if (p.isBackup) await setLastBackupAt(p.exportedAt)
    setNotice({
      tone: 'ok',
      text:
        result === 'shared'
          ? `${p.file.name} was sent to the share sheet.`
          : `${p.file.name} was downloaded.`,
    })
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setNotice(null)
    try {
      await task()
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      })
    } finally {
      setBusy(false)
    }
  }

  const exportJson = () =>
    run(async () => {
      const backup = await exportBackup()
      const file = new File([serializeBackup(backup)], backupFileName('json'), {
        type: 'application/json',
      })
      await deliver({ file, isBackup: true, exportedAt: backup.exportedAt })
    })

  const exportCsvFile = () =>
    run(async () => {
      const file = new File([await exportCsv()], backupFileName('csv'), { type: 'text/csv' })
      await deliver({ file, isBackup: false, exportedAt: Date.now() })
    })

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still fires
    if (!file) return
    void run(async () => {
      try {
        const backup = parseBackup(await file.text())
        setPreview({ backup, current: await summarizeCurrent() })
      } catch (err) {
        if (err instanceof BackupFormatError) {
          setNotice({ tone: 'error', text: `${err.message} Nothing was changed.` })
        } else throw err
      }
    })
  }

  const restore = (backup: Backup) =>
    run(async () => {
      setPreview(null)
      await importBackup(backup)
      restTimer.clear()
      const s = summarize(backup.data)
      setNotice({
        tone: 'ok',
        text: `Restored ${s.workouts} workouts and ${s.sets} sets from the ${day(backup.exportedAt)} backup.`,
      })
    })

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Section title="Units">
        <div className="bg-surface grid grid-cols-2 gap-1 rounded-xl p-1">
          {(['lb', 'kg'] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={settings.unit === u}
              onClick={() => void setUnit(u)}
              className={`min-h-11 rounded-lg text-base font-semibold ${
                settings.unit === u ? 'bg-accent text-accent-ink' : 'text-muted'
              }`}
            >
              {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
            </button>
          ))}
        </div>
        <Hint>
          Sets keep the unit they were logged in. History, charts and suggestions convert to the
          unit chosen here.
        </Hint>
      </Section>

      <Section title="Default rest time">
        <div className="bg-surface flex items-center justify-between rounded-xl p-1">
          <StepButton
            label="15 seconds less"
            disabled={settings.rest <= REST_LIMITS[0]}
            onClick={() => void setDefaultRestSeconds(settings.rest - 15)}
          >
            −15
          </StepButton>
          <span className="text-xl font-semibold tabular-nums">{formatClock(settings.rest)}</span>
          <StepButton
            label="15 seconds more"
            disabled={settings.rest >= REST_LIMITS[1]}
            onClick={() => void setDefaultRestSeconds(settings.rest + 15)}
          >
            +15
          </StepButton>
        </div>
        <Hint>
          Used when you add an exercise to a template or a workout. Exercises already in a template
          keep their own rest time.
        </Hint>
      </Section>

      <Section title="Default increments">
        <div className="bg-surface divide-line divide-y rounded-xl">
          {(['upper', 'lower'] as const).map((half) => (
            <div key={half} className="flex min-h-14 items-center gap-2 px-4">
              <span className="flex-1">{half === 'upper' ? 'Upper body' : 'Lower body'}</span>
              {(['lb', 'kg'] as const).map((u) => (
                <IncrementInput
                  key={u}
                  half={half}
                  unit={u}
                  value={settings.increments[half][u]}
                  onNotice={setNotice}
                />
              ))}
            </div>
          ))}
        </div>
        <Hint>
          The weight jump suggested when you hit the top of a rep range. Changing one updates every
          exercise still on the old default; an exercise you gave its own increment keeps it. Edit a
          single exercise under Templates → Exercises.
        </Hint>
      </Section>

      <Section title="Backup">
        <div className="bg-surface flex min-h-11 items-center justify-between rounded-xl px-4 text-sm">
          <span className="text-muted">Last backup</span>
          <span className={settings.stale ? 'text-amber-300' : ''}>
            {settings.lastBackupAt === null ? 'Never' : dateTime(settings.lastBackupAt)}
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportJson()}
          className="bg-accent text-accent-ink mt-2 min-h-13 w-full rounded-xl text-lg font-semibold disabled:opacity-50"
        >
          Export backup (JSON)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportCsvFile()}
          className="bg-surface mt-2 min-h-13 w-full rounded-xl font-medium disabled:opacity-50"
        >
          Export CSV
        </button>
        {settings.workoutActive ? (
          <button
            type="button"
            onClick={() =>
              setNotice({
                tone: 'error',
                text: 'Finish or discard the workout in progress before restoring a backup.',
              })
            }
            className="bg-surface text-muted mt-2 min-h-13 w-full rounded-xl font-medium"
          >
            Restore from backup…
          </button>
        ) : (
          <label
            className={`bg-surface mt-2 flex min-h-13 w-full cursor-pointer items-center justify-center rounded-xl font-medium ${busy ? 'opacity-50' : ''}`}
          >
            Restore from backup…
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={pickFile}
              className="sr-only"
            />
          </label>
        )}

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`mt-3 rounded-xl px-4 py-3 text-sm ${
              notice.tone === 'error' ? 'bg-red-950 text-red-200' : 'bg-surface-2 text-text'
            }`}
          >
            {notice.text}
          </p>
        )}
        <Hint>
          The JSON backup holds everything: workouts, templates, exercises and settings. Save it to
          iCloud Drive (Save to Files). The CSV has one row per set for spreadsheets and can't be
          restored from.
        </Hint>
      </Section>

      <Section title="This device">
        <dl className="bg-surface divide-line divide-y rounded-xl text-sm">
          <Row label="Installed to home screen" value={standalone ? 'Yes' : 'No'} />
          <Row
            label="Storage protected from clean-up"
            value={persistent === null ? 'Unknown' : persistent ? 'Yes' : 'No'}
          />
          <Row label="Network" value={navigator.onLine ? 'Online' : 'Offline'} />
          <Row label="Build" value={new Date(__BUILD_TIME__).toLocaleString()} />
        </dl>
      </Section>

      {pending && (
        <Sheet title={`${pending.file.name} is ready`} onClose={() => setPending(null)}>
          <SheetButton tone="primary" onClick={() => void run(() => deliver(pending))}>
            Save file
          </SheetButton>
          <SheetButton onClick={() => setPending(null)}>Cancel</SheetButton>
        </Sheet>
      )}

      {preview && (
        <RestoreSheet
          backup={preview.backup}
          current={preview.current}
          onCancel={() => setPreview(null)}
          onConfirm={() => void restore(preview.backup)}
        />
      )}
    </>
  )
}

function RestoreSheet({
  backup,
  current,
  onCancel,
  onConfirm,
}: {
  backup: Backup
  current: DataSummary
  onCancel: () => void
  onConfirm: () => void
}) {
  const incoming = summarize(backup.data)
  const rows: [string, number, number][] = [
    ['Workouts', incoming.workouts, current.workouts],
    ['Sets', incoming.sets, current.sets],
    ['Templates', incoming.templates, current.templates],
    ['Exercises', incoming.exercises, current.exercises],
    ['Custom exercises', incoming.customExercises, current.customExercises],
  ]
  const range = (s: DataSummary) =>
    s.firstWorkoutAt === null || s.lastWorkoutAt === null
      ? 'None'
      : s.firstWorkoutAt === s.lastWorkoutAt
        ? day(s.firstWorkoutAt)
        : `${day(s.firstWorkoutAt)} – ${day(s.lastWorkoutAt)}`
  const losing = current.workouts > 0 && incoming.lastWorkoutAt !== current.lastWorkoutAt

  return (
    <Sheet title="Restore this backup?" onClose={onCancel}>
      <p className="text-muted text-sm">Backup made {dateTime(backup.exportedAt)}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs">
            <th className="py-1 text-left font-medium"></th>
            <th className="py-1 text-right font-medium">In backup</th>
            <th className="py-1 text-right font-medium">On this phone</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-line border-t">
              <td className="py-2">{label}</td>
              <td className="py-2 text-right font-semibold">{a}</td>
              <td className="text-muted py-2 text-right">{b}</td>
            </tr>
          ))}
          <tr className="border-line border-t align-top">
            <td className="py-2">Workout dates</td>
            <td className="py-2 pl-2 text-right font-semibold">{range(incoming)}</td>
            <td className="text-muted py-2 pl-2 text-right">{range(current)}</td>
          </tr>
        </tbody>
      </table>
      <p className={`rounded-xl px-3 py-2 text-sm ${losing ? 'bg-red-950 text-red-200' : 'bg-surface-2'}`}>
        Restoring replaces everything on this phone with the backup. Anything logged here that isn't
        in the backup is lost and can't be recovered.
      </p>
      <SheetButton tone="danger" onClick={onConfirm}>
        Replace everything with this backup
      </SheetButton>
      <SheetButton onClick={onCancel}>Cancel</SheetButton>
    </Sheet>
  )
}

function IncrementInput({
  half,
  unit,
  value,
  onNotice,
}: {
  half: BodyHalf
  unit: Unit
  value: number
  onNotice: (n: Notice | null) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  async function commit() {
    const text = draft
    setDraft(null)
    if (text === null) return
    const next = Number(text.replace(',', '.'))
    if (!Number.isFinite(next) || next <= 0 || next === value) return
    const changed = await setIncrementDefault(half, unit, next)
    onNotice({
      tone: 'ok',
      text: `${half === 'upper' ? 'Upper' : 'Lower'} body default is now ${next} ${unit}. ${changed} exercises updated.`,
    })
  }

  return (
    <label className="flex items-center gap-1">
      <input
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={`${half} body increment in ${unit}`}
        className="bg-surface-2 h-11 w-16 rounded-lg text-center tabular-nums outline-none"
      />
      <span className="text-muted w-5 text-sm">{unit}</span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-muted mt-2 px-1 text-sm">{children}</p>
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="bg-surface-2 min-h-11 w-20 rounded-lg text-base font-semibold tabular-nums disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between px-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
