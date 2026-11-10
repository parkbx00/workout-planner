import { useState } from 'react'
import { formatWeight } from '../lib/format.ts'

const BASE =
  'h-11 w-full rounded-lg text-center text-lg font-semibold tabular-nums outline-none focus:ring-1 focus:ring-accent'

const parse = (text: string) => (text === '' || text === '.' ? null : Number(text))

interface Props {
  value: number | null
  onChange: (value: number | null) => void
  label: string
  className?: string
}

/**
 * Weight field. While focused, the raw text is kept locally (so "12." survives),
 * but every keystroke is still reported, so nothing is lost if the app closes mid-edit.
 */
export function WeightInput({ value, onChange, label, className = '' }: Props) {
  const [text, setText] = useState<string | null>(null)
  const shown = value === null ? '' : formatWeight(value)
  return (
    <input
      inputMode="decimal"
      enterKeyHint="done"
      aria-label={label}
      value={text ?? shown}
      onFocus={(e) => {
        setText(shown)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const next = e.target.value
          .replace(',', '.')
          .replace(/[^\d.]/g, '')
          .replace(/(\..*)\./g, '$1')
          .slice(0, 6)
        setText(next)
        onChange(parse(next))
      }}
      onBlur={() => setText(null)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`${BASE} ${className}`}
    />
  )
}

export function RepsInput({ value, onChange, label, className = '' }: Props) {
  const [text, setText] = useState<string | null>(null)
  const shown = value === null ? '' : String(value)
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="done"
      aria-label={label}
      value={text ?? shown}
      onFocus={(e) => {
        setText(shown)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, '').slice(0, 3)
        setText(next)
        onChange(parse(next))
      }}
      onBlur={() => setText(null)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`${BASE} ${className}`}
    />
  )
}
