export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted mt-3">{note}</p>
    </>
  )
}
