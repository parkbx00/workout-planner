import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isBackupDue } from '../db/backup.ts'
import { db } from '../db/db.ts'
import { getActiveSession, startSession } from '../db/sessions.ts'
import { DAY_LABEL } from '../lib/labels.ts'

export default function Today() {
  const navigate = useNavigate()
  const [today] = useState(() => new Date())

  const data = useLiveQuery(async () => {
    const [backupDue, active, templates, rows, exercises] = await Promise.all([
      isBackupDue(),
      getActiveSession(),
      db.templates.orderBy('order').toArray(),
      db.templateExercises.orderBy('[templateId+order]').toArray(),
      db.exercises.toArray(),
    ])
    const names = new Map(exercises.map((e) => [e.id, e.name]))
    const preview = new Map<string, string[]>()
    for (const r of rows) {
      preview.set(r.templateId, [
        ...(preview.get(r.templateId) ?? []),
        names.get(r.exerciseId) ?? 'Unknown exercise',
      ])
    }
    const activeTemplate = active?.templateId
      ? templates.find((t) => t.id === active.templateId)
      : undefined
    return { active: active ?? null, activeTemplate, templates, preview, backupDue }
  }, [])

  async function start(templateId: string | null) {
    await startSession(templateId)
    navigate('/workout')
  }

  const header = (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Today</h1>
      <p className="text-muted mt-1">
        {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </>
  )
  if (!data) return header

  const backupBanner = data.backupDue && (
    <Link
      to="/settings"
      className="mt-5 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-950/60 px-4 py-2"
    >
      <span>
        <span className="block font-semibold text-amber-200">Back up your workouts</span>
        <span className="block text-sm text-amber-100/80">
          No backup in the last 7 days. Your log lives only on this phone.
        </span>
      </span>
      <span aria-hidden="true" className="text-amber-200">
        ›
      </span>
    </Link>
  )

  if (data.active) {
    return (
      <>
        {header}
        {backupBanner}
        <section className="bg-surface mt-6 rounded-2xl p-4">
          <p className="text-accent text-sm font-semibold">Workout in progress</p>
          <h2 className="mt-1 text-2xl font-bold">{data.activeTemplate?.name ?? 'Workout'}</h2>
          <p className="text-muted mt-1 text-sm">
            Started{' '}
            {new Date(data.active.startedAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          <Link
            to="/workout"
            className="bg-accent text-accent-ink mt-4 flex min-h-16 items-center justify-center rounded-xl text-xl font-bold"
          >
            Resume workout
          </Link>
        </section>
      </>
    )
  }

  const todays = data.templates.find((t) => t.dayOfWeek === today.getDay())
  const others = data.templates.filter((t) => t !== todays)

  return (
    <>
      {header}
      {backupBanner}

      {todays ? (
        <section className="bg-surface mt-6 rounded-2xl p-4">
          <h2 className="text-2xl font-bold">{todays.name}</h2>
          <ol className="text-muted mt-2 space-y-0.5 text-sm">
            {(data.preview.get(todays.id) ?? []).map((name, i) => (
              <li key={i}>
                {i + 1}. {name}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => void start(todays.id)}
            className="bg-accent text-accent-ink mt-4 min-h-16 w-full rounded-xl text-xl font-bold"
          >
            Start workout
          </button>
        </section>
      ) : (
        <section className="bg-surface mt-6 rounded-2xl p-4">
          <h2 className="text-xl font-bold">No workout scheduled</h2>
          <p className="text-muted mt-1 text-sm">
            No template is set for {DAY_LABEL[today.getDay()]}. Pick one below if you want to train.
          </p>
        </section>
      )}

      <h2 className="text-muted mt-8 mb-2 text-xs font-semibold tracking-wide uppercase">
        {todays ? 'Start a different template' : 'Start a template'}
      </h2>
      <ul className="space-y-2">
        {others.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => void start(t.id)}
              className="bg-surface flex min-h-14 w-full items-center justify-between rounded-xl px-4 text-left"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-muted text-sm">
                {t.dayOfWeek === null ? '' : DAY_LABEL[t.dayOfWeek].slice(0, 3)} ·{' '}
                {data.preview.get(t.id)?.length ?? 0} exercises ›
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => void start(null)}
            className="border-line text-accent min-h-14 w-full rounded-xl border border-dashed font-semibold"
          >
            Empty workout
          </button>
        </li>
      </ul>
    </>
  )
}
