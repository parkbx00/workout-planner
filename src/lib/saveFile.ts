export type SaveResult =
  /** Handed to the share sheet and the user picked a destination. */
  | 'shared'
  /** No share sheet for files here, so the browser downloaded it. */
  | 'downloaded'
  /** The user closed the share sheet without saving. */
  | 'cancelled'
  /** The browser wants a fresh tap before it will open the share sheet. */
  | 'needs-tap'

export function canShareFile(file: File): boolean {
  return typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true
}

/**
 * Saves a file through the share sheet (Save to Files, AirDrop, …) where the
 * browser can share files, otherwise as a normal download.
 */
export async function saveFile(file: File): Promise<SaveResult> {
  if (canShareFile(file)) {
    try {
      // No title or text: iOS would save them as an extra text file beside the backup.
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError') return 'needs-tap'
      // Anything else: fall through to a download.
    }
  }
  download(file)
  return 'downloaded'
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Asks the browser not to evict this app's data under storage pressure. Safe to call on every launch. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isStoragePersistent(): Promise<boolean | null> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null
  } catch {
    return null
  }
}
