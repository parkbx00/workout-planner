import { beepIfStalled, cancelBeep, scheduleBeep, unlockAudio } from './beep.ts'

/**
 * Rest timer state. It stores the wall-clock time the rest ends rather than
 * counting ticks, so it stays correct after the screen locks, the app is
 * backgrounded, or the page reloads.
 */
export interface RestState {
  endsAt: number
  totalSeconds: number
}

const KEY = 'liftlog:rest'
/** A timer that ran out more than this long ago isn't worth announcing on return. */
const STALE_MS = 60_000

function load(): RestState | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RestState | null
    return saved && saved.endsAt > Date.now() - STALE_MS ? saved : null
  } catch {
    return null
  }
}

let state: RestState | null = load()
const listeners = new Set<() => void>()

function set(next: RestState | null) {
  state = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: the timer still works for this page load
  }
  for (const listener of listeners) listener()
}

export const remainingMs = (s: RestState, now = Date.now()) => Math.max(0, s.endsAt - now)

export const restTimer = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => state,

  /** Call from the tap that checks off a set (the tap is what allows sound on iOS). */
  start(seconds: number, now = Date.now()) {
    unlockAudio()
    scheduleBeep(seconds)
    set({ endsAt: now + seconds * 1000, totalSeconds: seconds })
  },

  adjust(deltaSeconds: number, now = Date.now()) {
    if (!state) return
    const endsAt = Math.max(now, state.endsAt + deltaSeconds * 1000)
    unlockAudio()
    scheduleBeep((endsAt - now) / 1000)
    set({ endsAt, totalSeconds: Math.max(1, state.totalSeconds + deltaSeconds) })
  },

  /** Skip, or tidy up after the timer has finished. */
  clear() {
    cancelBeep()
    set(null)
  },

  /** Re-align the scheduled beep with the wall clock after the app returns to the foreground. */
  resync(now = Date.now()) {
    if (state && state.endsAt > now) scheduleBeep((state.endsAt - now) / 1000)
  },

  onZero: beepIfStalled,
}
