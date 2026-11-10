import { useRegisterSW } from 'virtual:pwa-register/react'

/** Shows "new version" and "ready offline" notices from the service worker. */
export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed PWA can stay open for days; check for updates when it returns to the foreground.
      if (!registration) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    },
  })

  if (needRefresh) {
    return (
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="bg-accent text-accent-ink mx-4 mb-2 min-h-11 rounded-xl px-4 text-sm font-semibold"
      >
        New version – tap to refresh
      </button>
    )
  }

  if (offlineReady) {
    return (
      <button
        type="button"
        onClick={() => setOfflineReady(false)}
        className="bg-surface-2 text-text mx-4 mb-2 min-h-11 rounded-xl px-4 text-sm"
      >
        Ready to work offline ✓
      </button>
    )
  }

  return null
}
