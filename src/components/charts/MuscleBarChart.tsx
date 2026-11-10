import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { MUSCLE_GROUPS } from '../../db/types.ts'
import type { MuscleCounts } from '../../lib/charts.ts'
import { MUSCLE_LABEL } from '../../lib/labels.ts'
import { CHART } from './theme.ts'

/**
 * Sets per muscle group for one week. Every group is always listed in the same
 * order, and every bar carries its number, so the chart reads without hovering.
 * `max` fixes the scale so bars stay comparable while flipping between weeks.
 */
export default function MuscleBarChart({ counts, max }: { counts: MuscleCounts; max: number }) {
  const data = MUSCLE_GROUPS.map((g) => ({ label: MUSCLE_LABEL[g], sets: counts[g] }))
  return (
    <div style={{ height: data.length * 32 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 32, bottom: 4, left: 0 }}
          barCategoryGap={0}
        >
          <XAxis type="number" hide domain={[0, Math.max(1, max)]} />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            tick={{ fill: CHART.secondary, fontSize: 13 }}
            tickLine={false}
            axisLine={{ stroke: CHART.axis }}
          />
          <Bar
            dataKey="sets"
            fill={CHART.series}
            barSize={16}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="sets"
              position="right"
              offset={8}
              fill={CHART.ink}
              fontSize={13}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
