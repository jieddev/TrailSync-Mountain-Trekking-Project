import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useAuth } from '../../../app/AuthContext'
import {
  getCoordinatorAnalytics,
  type CoordinatorAnalytics,
} from '../../../lib/analytics-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import { manilaTodayIso } from '../../booking/lib/booking-form'
import {
  bookedValueRows,
  bookingStatusOrder,
  formatMinutes,
  formatPeso,
  presetRange,
  rangePresets,
  rangeProblem,
  singleSeriesColor,
  trailColor,
  visitorRows,
  type DateRange,
  type RangePreset,
} from '../lib/analytics'
import { cardClass } from '../lib/ui'

// The result for one range; anything else on screen is still loading.
type LoadResult = { key: string } & (
  { status: 'error' } | { status: 'loaded'; analytics: CoordinatorAnalytics }
)

const rangeKey = ({ from, to }: DateRange) => `${from}/${to}`

// Recessive axes and grid; text stays in the page's ink colours.
const axisTick = { fill: '#52675e', fontSize: 12 }
const gridStroke = '#e7ece8'
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #d5e1da',
  fontSize: 13,
  color: '#173a2e',
}
const cursorFill = { fill: '#f3f6f2' }

const inputClass =
  'rounded-lg border border-[#d5e1da] bg-white px-3 py-2 text-sm text-[#173a2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]'

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={`${cardClass} min-w-0`}>
      <h2 className="text-lg font-bold text-[#173a2e]" id={id}>
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-[#52675e]">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatTile({
  label,
  value,
  detail,
  tag,
}: {
  label: string
  value: string | number
  detail?: string
  tag?: string
}) {
  return (
    <li className="rounded-2xl border border-[#d5e1da] bg-white p-5">
      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#173a2e]">
        {label}
        {tag && (
          <span className="rounded-full bg-[#fff8e3] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#7a5300]">
            {tag}
          </span>
        )}
      </p>
      <p className="mt-2 font-serif text-4xl font-bold leading-none text-[#002d20]">
        {value}
      </p>
      {detail && <p className="mt-2 text-sm text-[#52675e]">{detail}</p>}
    </li>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-[#f7f9f6] px-4 py-6 text-center text-sm text-[#52675e]">
      {children}
    </p>
  )
}

function RangePicker({
  range,
  onChange,
}: {
  range: DateRange
  onChange: (range: DateRange) => void
}) {
  const [draft, setDraft] = useState(range)
  const today = manilaTodayIso()
  const problem = rangeProblem(draft)

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div
        aria-label="Date range presets"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {rangePresets.map((preset) => {
          const value = presetRange(preset.id as RangePreset, today)
          const active = value.from === range.from && value.to === range.to
          return (
            <button
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${
                active
                  ? 'border-[#477a69] bg-[#477a69] text-white'
                  : 'border-[#d5e1da] bg-white text-[#173a2e] hover:bg-[#f3f6f2]'
              }`}
              key={preset.id}
              onClick={() => onChange(value)}
              type="button"
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!problem) onChange(draft)
        }}
      >
        <label className="grid gap-1 text-xs font-bold text-[#52675e]">
          From
          <input
            className={inputClass}
            max={today}
            onChange={(event) =>
              setDraft({ ...draft, from: event.target.value })
            }
            type="date"
            value={draft.from}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#52675e]">
          To
          <input
            className={inputClass}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            type="date"
            value={draft.to}
          />
        </label>
        <button
          className="rounded-lg border border-[#d5e1da] bg-white px-4 py-2 text-sm font-bold text-[#173a2e] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] disabled:opacity-60"
          disabled={Boolean(problem)}
          type="submit"
        >
          Apply
        </button>
      </form>
      {problem && (
        <p
          className="w-full text-sm font-semibold text-[#7a5300]"
          role="status"
        >
          {problem}
        </p>
      )}
    </div>
  )
}

function VisitorsChart({ analytics }: { analytics: CoordinatorAnalytics }) {
  if (analytics.visitors.total === 0) {
    return <Empty>No completed treks in this range yet.</Empty>
  }
  const lastTrail = analytics.trails.length - 1
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={visitorRows(analytics)} margin={{ top: 8, right: 8 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={axisTick}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={axisTick}
            tickLine={false}
            width={32}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={cursorFill} />
          <Legend
            iconType="square"
            wrapperStyle={{ fontSize: 13, color: '#173a2e' }}
          />
          {analytics.trails.map((trail, index) => (
            <Bar
              dataKey={trail.id}
              fill={trailColor(index)}
              key={trail.id}
              maxBarSize={36}
              name={trail.name}
              // Only the top segment gets rounded ends.
              radius={index === lastTrail ? [4, 4, 0, 0] : 0}
              stackId="visitors"
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GuidesChart({ analytics }: { analytics: CoordinatorAnalytics }) {
  const { guides } = analytics
  if (guides.length === 0) return <Empty>No guide accounts yet.</Empty>
  return (
    <div style={{ height: Math.max(120, guides.length * 40 + 32) }}>
      <ResponsiveContainer>
        <BarChart
          data={guides}
          layout="vertical"
          margin={{ top: 0, right: 32, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke={gridStroke} />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            tick={axisTick}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="fullName"
            tick={axisTick}
            tickLine={false}
            type="category"
            width={120}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={cursorFill} />
          <Bar
            dataKey="completedTreks"
            fill={singleSeriesColor}
            maxBarSize={20}
            name="Completed treks"
            radius={[0, 4, 4, 0]}
          >
            <LabelList
              dataKey="completedTreks"
              fill="#173a2e"
              fontSize={12}
              position="right"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BookedValueChart({ analytics }: { analytics: CoordinatorAnalytics }) {
  if (analytics.bookedValue.total === 0) {
    return <Empty>No completed treks in this range yet.</Empty>
  }
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart
          data={bookedValueRows(analytics)}
          margin={{ top: 8, right: 8 }}
        >
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={axisTick}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={axisTick}
            tickFormatter={(value: number) => formatPeso(value)}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={cursorFill}
            formatter={(value) => formatPeso(Number(value))}
          />
          <Bar
            dataKey="amount"
            fill={singleSeriesColor}
            maxBarSize={36}
            name="Booked value"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const tableHead =
  'border-b border-[#e7ece8] py-2 pr-4 text-left text-xs font-bold uppercase tracking-wide text-[#70857b]'
const tableCell = 'border-b border-[#f0f3f1] py-2 pr-4 text-[#173a2e]'
const numberCell = `${tableCell} text-right tabular-nums`

function TrailTable({ analytics }: { analytics: CoordinatorAnalytics }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr>
            <th className={tableHead}>Trail</th>
            <th className={`${tableHead} text-right`}>Completed treks</th>
            <th className={`${tableHead} text-right`}>Visitors</th>
            <th className={`${tableHead} text-right`}>Avg. group size</th>
          </tr>
        </thead>
        <tbody>
          {analytics.trails.map((trail, index) => (
            <tr key={trail.id}>
              <td className={tableCell}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: trailColor(index) }}
                  />
                  {trail.name}
                </span>
              </td>
              <td className={numberCell}>{trail.completedTreks}</td>
              <td className={numberCell}>{trail.visitors}</td>
              <td className={numberCell}>{trail.averageGroupSize ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusTable({ analytics }: { analytics: CoordinatorAnalytics }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {bookingStatusOrder.map(({ status, label }) => (
          <tr key={status}>
            <td className={tableCell}>{label}</td>
            <td className={numberCell}>
              {analytics.bookingsByStatus[status] ?? 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SafetySummary({ analytics }: { analytics: CoordinatorAnalytics }) {
  const { safety } = analytics
  const rows: [string, string | number][] = [
    ['SOS incidents', safety.incidents],
    ['Not yet resolved', safety.openIncidents],
    [
      'Median time to acknowledge',
      formatMinutes(safety.medianMinutesToAcknowledge),
    ],
    ['Median time to resolve', formatMinutes(safety.medianMinutesToResolve)],
  ]
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className={tableCell}>{label}</td>
              <td className={numberCell}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={tableHead}>Trail</th>
            <th className={`${tableHead} text-right`}>Days closed</th>
          </tr>
        </thead>
        <tbody>
          {safety.closureDaysByTrail.map((trail) => (
            <tr key={trail.trailId}>
              <td className={tableCell}>{trail.name}</td>
              <td className={numberCell}>{trail.days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<DateRange>(() =>
    presetRange('last-6-months', manilaTodayIso()),
  )
  const [result, setResult] = useState<LoadResult | null>(null)
  const key = rangeKey(range)
  const state = result?.key === key ? result : { status: 'loading' as const }

  useEffect(() => {
    let isCurrent = true
    user!
      .getIdToken()
      .then((idToken) => getCoordinatorAnalytics(idToken, range))
      .then((analytics) => {
        if (isCurrent) setResult({ key, status: 'loaded', analytics })
      })
      .catch(() => {
        if (isCurrent) setResult({ key, status: 'error' })
      })
    return () => {
      isCurrent = false
    }
  }, [user, range, key])

  return (
    <>
      <PageHeader eyebrow="Reports" title="Analytics">
        Visitors, trail use, guide activity, and safety, counted from the treks
        recorded in TrailSync. Dates follow each trek’s scheduled day.
      </PageHeader>

      {/* Keyed so a preset resets the date inputs. */}
      <RangePicker key={key} onChange={setRange} range={range} />

      {state.status === 'loading' && (
        <StatusCard role="status">Loading analytics…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Analytics couldn’t load">
          We couldn’t load analytics for this range. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && (
        <AnalyticsBody analytics={state.analytics} />
      )}
    </>
  )
}

function AnalyticsBody({ analytics }: { analytics: CoordinatorAnalytics }) {
  return (
    <div className="grid gap-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          detail={`${analytics.visitors.walkIns} added as walk-ins`}
          label="Visitors"
          value={analytics.visitors.total}
        />
        <StatTile label="Completed treks" value={analytics.completedTreks} />
        <StatTile
          detail={`${analytics.safety.openIncidents} not yet resolved`}
          label="SOS incidents"
          value={analytics.safety.incidents}
        />
        <StatTile
          detail="Package prices of completed treks"
          label="Booked value"
          tag={analytics.bookedValue.testMode ? 'Test mode' : undefined}
          value={formatPeso(analytics.bookedValue.total)}
        />
      </ul>

      <Section
        description="Hikers who went on a completed trek, by month and trail. Absent participants are not counted; walk-ins are."
        id="visitors-title"
        title="Visitors per month"
      >
        <VisitorsChart analytics={analytics} />
      </Section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Section id="trails-title" title="Trail usage">
          <TrailTable analytics={analytics} />
        </Section>
        <Section
          description="Bookings scheduled in this range, by their current status."
          id="status-title"
          title="Bookings by status"
        >
          <StatusTable analytics={analytics} />
        </Section>
      </div>

      <Section
        description="Completed treks per guide. Under FIFO dispatch, these should stay close for guides who are on duty equally often."
        id="guides-title"
        title="Guide activity"
      >
        <GuidesChart analytics={analytics} />
      </Section>

      <Section
        description="SOS alerts raised in this range, and days each trail was closed by a coordinator."
        id="safety-title"
        title="Safety"
      >
        <SafetySummary analytics={analytics} />
      </Section>

      <Section
        description={
          analytics.bookedValue.testMode
            ? 'Package prices of completed treks. GCash runs in test mode, so this is what was booked, not money received.'
            : 'Package prices of completed treks.'
        }
        id="value-title"
        title="Booked value per month"
      >
        <BookedValueChart analytics={analytics} />
      </Section>
    </div>
  )
}
