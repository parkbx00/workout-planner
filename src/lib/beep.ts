/**
 * Rest-timer sound via Web Audio. iOS only lets audio start from a user gesture,
 * so the context is created/resumed when a set is checked off, and the beep is
 * scheduled on the audio clock right then. That way it still fires on time even
 * if JavaScript timers are being throttled.
 */
let ctx: AudioContext | null = null
let scheduled: OscillatorNode[] = []

/** Call from inside a tap handler. */
export function unlockAudio(): void {
  if (typeof AudioContext === 'undefined') return
  try {
    // Mix with (rather than pause) music playing from another app, where the API exists.
    const session = (navigator as { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'transient'
    ctx ??= new AudioContext()
    if (ctx.state !== 'running') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function cancelBeep(): void {
  for (const osc of scheduled) {
    try {
      osc.stop()
      osc.disconnect()
    } catch {
      // already stopped
    }
  }
  scheduled = []
}

/** Schedules three short beeps to start `inSeconds` from now, replacing any pending ones. */
export function scheduleBeep(inSeconds: number): void {
  cancelBeep()
  if (!ctx) return
  const start = ctx.currentTime + Math.max(0, inSeconds)
  for (let i = 0; i < 3; i++) {
    const at = start + i * 0.28
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = i === 2 ? 1175 : 880
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.6, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.22)
    scheduled.push(osc)
  }
}

/** At zero: if the audio clock was paused (app was in the background), the scheduled beep is late, so play it now. */
export function beepIfStalled(): void {
  if (!ctx || ctx.state === 'running') return
  void ctx.resume().then(() => scheduleBeep(0))
}
