import { useEffect, useState, useSyncExternalStore } from 'react'
import { formatClock } from '../lib/format.ts'
import { remainingMs, restTimer } from '../lib/restTimer.ts'

/** Sticky rest countdown shown above the tab bar on every screen while a rest is running. */
export default function RestBar() {
  const state = useSyncExternalStore(restTimer.subscribe, restTimer.getSnapshot)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!state) return
    const tick = () => setNow(Date.now())
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      restTimer.resync()
      tick()
    }
    const id = setInterval(tick, 200)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state])

  // `now` can be older than a just-started timer until the first tick; never show more than the full rest.
  const remaining = state ? Math.min(remainingMs(state, now), state.totalSeconds * 1000) : 0
  const done = state !== null && remainingMs(state, now) === 0

  useEffect(() => {
    if (!done) return
    restTimer.onZero()
    const id = setTimeout(() => restTimer.clear(), 3000)
    return () => clearTimeout(id)
  }, [done])

  if (!state) return null

  const button = 'bg-surface-2 min-h-11 min-w-13 rounded-lg px-2 text-sm font-semibold'

  return (
    <>
      {done && (
        <div className="rest-flash bg-accent pointer-events-none fixed inset-0 z-50 opacity-0" />
      )}
      <div
        role="timer"
        aria-label="Rest timer"
        className={`border-line relative border-t px-4 py-2 ${done ? 'bg-accent text-accent-ink' : 'bg-surface'}`}
      >
        {!done && (
          <div
            className="bg-accent absolute top-0 left-0 h-0.5"
            style={{ width: `${(remaining / (state.totalSeconds * 1000)) * 100}%` }}
          />
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs font-medium opacity-70">{done ? 'Rest over' : 'Rest'}</div>
            <div className="text-2xl leading-tight font-bold tabular-nums">
              {done ? 'Go!' : formatClock(Math.ceil(remaining / 1000))}
            </div>
          </div>
          {!done && (
            <>
              <button type="button" className={button} onClick={() => restTimer.adjust(-15)}>
                −15s
              </button>
              <button type="button" className={button} onClick={() => restTimer.adjust(15)}>
                +15s
              </button>
              <button type="button" className={button} onClick={() => restTimer.clear()}>
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
