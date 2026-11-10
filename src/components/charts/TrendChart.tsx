import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { spreadTicks } from '../../lib/charts.ts'
import { formatWeight } from '../../lib/format.ts'
import { CHART } from './theme.ts'

export interface TrendDatum {
  t: number
  value: number
  /** Extra text for the tooltip, e.g. "× 8". */
  detail?: string
}

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** A single-series line over time. The caption carries the latest value and the change since the first point. */
export default function TrendChart({
  title,
  data,
  unit,
}: {
  title: string
  data: TrendDatum[]
  unit: string
}) {
  const last = data[data.length - 1]
  const first = data[0]
  const change = last.value - first.value

  return (
    <figure className="bg-surface rounded-2xl p-3">
      <figcaption className="flex items-baseline justify-between gap-3 px-1">
        <span className="font-semibold">{title}</span>
        <span className="text-muted text-sm">
          {formatWeight(last.value)} {unit}
          {data.length > 1 && (
            <>
              {' · '}
              {change > 0 ? '+' : change < 0 ? '−' : '±'}
              {formatWeight(Math.abs(change))} since {shortDate(first.t)}
            </>
          )}
        </span>
      </figcaption>

      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={spreadTicks(data.map((d) => d.t))}
              tickFormatter={shortDate}
              tick={{ fill: CHART.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              width={40}
              domain={['auto', 'auto']}
              allowDecimals={false}
              tick={{ fill: CHART.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              content={({ active, payload }) => (
                <TrendTooltip
                  datum={active ? (payload?.[0]?.payload as TrendDatum | undefined) : undefined}
                  unit={unit}
                />
              )}
            />
            <Line
              dataKey="value"
              stroke={CHART.series}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

function TrendTooltip({ datum, unit }: { datum: TrendDatum | undefined; unit: string }) {
  if (!datum) return null
  return (
    <div className="bg-surface-2 border-line rounded-lg border px-3 py-2 text-sm shadow-lg">
      <div className="text-text font-semibold tabular-nums">
        {formatWeight(datum.value)} {unit}
        {datum.detail && <span className="font-normal"> {datum.detail}</span>}
      </div>
      <div className="text-muted">
        {new Date(datum.t).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </div>
    </div>
  )
}
