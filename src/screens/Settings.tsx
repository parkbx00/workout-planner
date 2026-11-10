export default function Settings() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="text-muted mt-3">Units, backup and restore arrive in Phase 6.</p>

      <dl className="bg-surface divide-line mt-6 divide-y rounded-xl text-sm">
        <Row label="Installed to home screen" value={standalone ? 'Yes' : 'No'} />
        <Row label="Network" value={navigator.onLine ? 'Online' : 'Offline'} />
        <Row label="Build" value={new Date(__BUILD_TIME__).toLocaleString()} />
      </dl>
    </>
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
