import type { ReactNode } from 'react'

/** Bottom sheet for menus and confirmations. Tapping the backdrop closes it. */
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full max-w-md rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  )
}

export function SheetButton({
  onClick,
  children,
  tone = 'normal',
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  tone?: 'normal' | 'primary' | 'danger'
  disabled?: boolean
}) {
  const tones = {
    normal: 'bg-surface-2 text-text',
    primary: 'bg-accent text-accent-ink font-semibold',
    danger: 'bg-surface-2 text-red-400',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-13 w-full rounded-xl px-4 text-left text-base disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}
