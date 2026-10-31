/**
 * The lazy chunk of the charts: the bar and line renderers of the OpenUI shadcn example (recharts).
 * Only a program that renders a chart loads this chunk.
 * @module @deepwidgets/shell/charts-impl
 */
import { Bar, CartesianGrid, Line, BarChart as RechartsBarChart, LineChart as RechartsLineChart, XAxis, YAxis } from 'recharts'
import { buildChartData } from './components/helpers.ts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart.tsx'

/** The props of `BarChart` and `LineChart`. */
export interface ChartProps {
  labels: string[]
  series: { category: string, values: number[] }[]
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const color = (index: number): string => COLORS[index % COLORS.length] ?? 'var(--chart-1)'

function buildConfig(keys: string[]): ChartConfig {
  const config: ChartConfig = {}
  keys.forEach((key, index) => { config[key] = { label: key, color: color(index) } })
  return config
}

// buildChartData reads element nodes (Series(...) calls). A plain { category, values } object is wrapped as one.
const chartData = (props: ChartProps): Record<string, string | number>[] =>
  buildChartData(props.labels, props.series.map((series) => ('type' in series ? series : { type: 'element', props: series })))

function seriesKeys(data: Record<string, string | number>[]): string[] {
  const first = data[0]
  return first === undefined ? [] : Object.keys(first).filter((key) => key !== 'category')
}

export function BarChartImpl({ props }: { props: ChartProps }) {
  const data = chartData(props)
  if (data.length === 0) return null
  const keys = seriesKeys(data)
  return (
    <ChartContainer config={buildConfig(keys)} className="min-h-[200px] w-full">
      <RechartsBarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((key, index) => <Bar key={key} dataKey={key} fill={color(index)} radius={4} isAnimationActive={false} />)}
      </RechartsBarChart>
    </ChartContainer>
  )
}

export function LineChartImpl({ props }: { props: ChartProps }) {
  const data = chartData(props)
  if (data.length === 0) return null
  const keys = seriesKeys(data)
  return (
    <ChartContainer config={buildConfig(keys)} className="min-h-[200px] w-full">
      <RechartsLineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="category" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((key, index) => (
          <Line key={key} type="monotone" dataKey={key} stroke={color(index)} strokeWidth={2} dot={false} isAnimationActive={false} />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  )
}
