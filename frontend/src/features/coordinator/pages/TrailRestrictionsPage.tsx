import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import {
  createTrailRestriction,
  liftTrailRestriction,
  listTrailRestrictions,
  type TrailRestriction,
} from '../../../lib/trail-restrictions-api'
import { listTrails, type Trail } from '../../../lib/trails-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import { formatDateRange, manilaTodayIso } from '../../booking/lib/booking-form'
import WeatherCard from '../../weather/components/WeatherCard'
import { useWeather } from '../../weather/lib/use-weather'
import ConfirmAction from '../components/ConfirmAction'
import type { Notice } from '../lib/dispatch'
import { cardClass, primaryButtonClass } from '../lib/ui'
import { useCoordinatorSummary } from '../lib/coordinator-summary'

const MAX_REASON_LENGTH = 500

type PageState =
  | { status: 'loading' }
  | { status: 'loaded'; trails: Trail[]; restrictions: TrailRestriction[] }
  | { status: 'error' }

type FormValues = {
  trailId: string
  startDate: string
  endDate: string
  reason: string
}
type FormErrors = Partial<Record<keyof FormValues, string>>

const statusLabels: Record<TrailRestriction['status'], string> = {
  ACTIVE: 'Closed today',
  UPCOMING: 'Upcoming',
  ENDED: 'Ended',
  LIFTED: 'Lifted',
}

const fieldClass =
  'mt-2 w-full rounded-lg border border-[#d5e1da] bg-white px-3 py-2.5 text-sm text-[#173a2e] focus:border-[#008755] focus:outline-none focus:ring-2 focus:ring-[#008755]/30'
const labelClass = 'block text-sm font-bold text-[#173a2e]'

function validate(values: FormValues, today: string): FormErrors {
  const errors: FormErrors = {}
  if (!values.trailId) errors.trailId = 'Select a trail.'
  if (!values.startDate) errors.startDate = 'Choose the first closed day.'
  if (!values.endDate) errors.endDate = 'Choose the last closed day.'
  else if (values.startDate && values.endDate < values.startDate)
    errors.endDate = 'The last day cannot be before the first day.'
  else if (values.endDate < today)
    errors.endDate = 'The last day cannot be in the past.'
  if (!values.reason.trim()) errors.reason = 'Give a reason.'
  else if (values.reason.trim().length > MAX_REASON_LENGTH)
    errors.reason = `Use at most ${MAX_REASON_LENGTH} characters.`
  return errors
}

export default function TrailRestrictionsPage() {
  const { user } = useAuth()
  const { refresh: refreshSummary } = useCoordinatorSummary()
  const today = manilaTodayIso()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const weather = useWeather()
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [values, setValues] = useState<FormValues>({
    trailId: '',
    startDate: today,
    endDate: today,
    reason: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const idToken = await user!.getIdToken()
        const [trails, restrictions] = await Promise.all([
          listTrails(),
          listTrailRestrictions(idToken),
        ])
        if (isCurrent) setState({ status: 'loaded', trails, restrictions })
      } catch {
        if (isCurrent) setState({ status: 'error' })
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [user, reloadKey])

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    const found = validate(values, today)
    setErrors(found)
    if (Object.keys(found).length) return

    setIsSaving(true)
    try {
      const idToken = await user!.getIdToken()
      const created = await createTrailRestriction(idToken, {
        ...values,
        reason: values.reason.trim(),
      })
      setNotice({
        tone: 'success',
        text: `${created.trail.name} is closed for ${formatDateRange(created.startDate, created.endDate)}.`,
      })
      setValues({ trailId: '', startDate: today, endDate: today, reason: '' })
      setReloadKey((key) => key + 1)
      refreshSummary()
    } catch (error) {
      if (error instanceof ApiError && error.details.length) {
        const fromApi: FormErrors = {}
        for (const detail of error.details) {
          fromApi[detail.field as keyof FormValues] ??= detail.message
        }
        setErrors(fromApi)
      } else {
        setNotice({
          tone: 'error',
          text: 'We couldn’t restrict this trail. Please try again.',
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function lift(restriction: TrailRestriction) {
    setNotice(null)
    try {
      const idToken = await user!.getIdToken()
      await liftTrailRestriction(idToken, restriction.id)
      setNotice({
        tone: 'success',
        text: `${restriction.trail.name} is open again for ${formatDateRange(restriction.startDate, restriction.endDate)}.`,
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          error instanceof ApiError &&
          error.code === 'RESTRICTION_ALREADY_LIFTED'
            ? 'This restriction was already lifted. Showing the latest list.'
            : 'We couldn’t lift this restriction. Please try again.',
      })
    } finally {
      setReloadKey((key) => key + 1)
      refreshSummary()
    }
  }

  const restrictions = state.status === 'loaded' ? state.restrictions : []
  const current = restrictions
    .filter((item) => item.status === 'ACTIVE' || item.status === 'UPCOMING')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const history = restrictions.filter(
    (item) => item.status === 'ENDED' || item.status === 'LIFTED',
  )

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Trail restrictions">
        Close a trail for bad weather or unsafe trail conditions. While a
        restriction applies, TrailSync refuses new bookings and reschedules onto
        those dates, check-in, guide dispatch, and trek starts. Existing
        bookings are not changed; hikers and guides see your reason.
      </PageHeader>

      {notice && (
        <p
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-[#b9d8c8] bg-[#eef7f1] text-[#006b43]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
          role={notice.tone === 'success' ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      )}

      {state.status === 'loading' && (
        <StatusCard role="status">Loading trail restrictions…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Restrictions couldn’t load">
          We couldn’t load trail restrictions. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && (
        <div className="grid gap-6">
          <WeatherCard state={weather} />
          <form className={cardClass} noValidate onSubmit={handleSubmit}>
            <h2 className="text-sm font-bold text-[#173a2e]">
              Restrict a trail
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="restriction-trail">
                  Trail
                </label>
                <select
                  aria-describedby={
                    errors.trailId ? 'restriction-trail-error' : undefined
                  }
                  aria-invalid={Boolean(errors.trailId)}
                  className={fieldClass}
                  id="restriction-trail"
                  onChange={(event) => update('trailId', event.target.value)}
                  value={values.trailId}
                >
                  <option value="">Select a trail</option>
                  {state.trails.map((trail) => (
                    <option key={trail.id} value={trail.id}>
                      {trail.name}
                    </option>
                  ))}
                </select>
                {errors.trailId && (
                  <p
                    className="mt-1 text-sm text-rose-700"
                    id="restriction-trail-error"
                  >
                    {errors.trailId}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="restriction-start">
                  First closed day
                </label>
                <input
                  aria-describedby={
                    errors.startDate ? 'restriction-start-error' : undefined
                  }
                  aria-invalid={Boolean(errors.startDate)}
                  className={fieldClass}
                  id="restriction-start"
                  onChange={(event) => update('startDate', event.target.value)}
                  type="date"
                  value={values.startDate}
                />
                {errors.startDate && (
                  <p
                    className="mt-1 text-sm text-rose-700"
                    id="restriction-start-error"
                  >
                    {errors.startDate}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="restriction-end">
                  Last closed day
                </label>
                <input
                  aria-describedby={
                    errors.endDate ? 'restriction-end-error' : undefined
                  }
                  aria-invalid={Boolean(errors.endDate)}
                  className={fieldClass}
                  id="restriction-end"
                  min={values.startDate || today}
                  onChange={(event) => update('endDate', event.target.value)}
                  type="date"
                  value={values.endDate}
                />
                {errors.endDate && (
                  <p
                    className="mt-1 text-sm text-rose-700"
                    id="restriction-end-error"
                  >
                    {errors.endDate}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass} htmlFor="restriction-reason">
                Reason
              </label>
              <p className="mt-1 text-sm text-[#70857b]">
                Shown to hikers and guides, for example “PAGASA heavy rainfall
                warning” or “Trail damaged by a landslide”.
              </p>
              <textarea
                aria-describedby={
                  errors.reason ? 'restriction-reason-error' : undefined
                }
                aria-invalid={Boolean(errors.reason)}
                className={`${fieldClass} min-h-24`}
                id="restriction-reason"
                maxLength={MAX_REASON_LENGTH}
                onChange={(event) => update('reason', event.target.value)}
                value={values.reason}
              />
              {errors.reason && (
                <p
                  className="mt-1 text-sm text-rose-700"
                  id="restriction-reason-error"
                >
                  {errors.reason}
                </p>
              )}
            </div>
            <button
              className={`mt-5 ${primaryButtonClass}`}
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? 'Restricting…' : 'Restrict trail'}
            </button>
          </form>

          <section className={cardClass}>
            <h2 className="text-sm font-bold text-[#173a2e]">
              Closed now and upcoming ({current.length})
            </h2>
            {current.length === 0 ? (
              <p className="mt-3 text-sm text-[#52675e]">
                Every trail is open.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#e7ece8]">
                {current.map((restriction) => (
                  <li
                    className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-start sm:justify-between"
                    key={restriction.id}
                  >
                    <div>
                      <p className="font-bold text-[#173a2e]">
                        {restriction.trail.name}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${restriction.status === 'ACTIVE' ? 'bg-rose-50 text-rose-700' : 'bg-[#fdf3dc] text-[#7a5300]'}`}
                        >
                          {statusLabels[restriction.status]}
                        </span>
                      </p>
                      <p className="mt-1 text-[#52675e]">
                        {formatDateRange(
                          restriction.startDate,
                          restriction.endDate,
                        )}
                      </p>
                      <p className="mt-1 text-[#173a2e]">
                        {restriction.reason}
                      </p>
                      <p className="mt-1 text-[#70857b]">
                        By {restriction.createdBy.fullName}
                      </p>
                    </div>
                    <div className="sm:max-w-xs sm:text-right">
                      <ConfirmAction
                        busyLabel="Lifting…"
                        confirmLabel="Yes, reopen"
                        label="Lift restriction"
                        onConfirm={() => lift(restriction)}
                        question={`Reopen ${restriction.trail.name} for these dates? Bookings, check-in and trek starts are allowed again.`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 && (
            <section className={cardClass}>
              <h2 className="text-sm font-bold text-[#173a2e]">History</h2>
              <ul className="mt-3 divide-y divide-[#e7ece8]">
                {history.map((restriction) => (
                  <li className="py-4 text-sm" key={restriction.id}>
                    <p className="font-bold text-[#173a2e]">
                      {restriction.trail.name}
                      <span className="ml-2 rounded-full bg-[#eef2ef] px-2 py-0.5 text-xs font-bold text-[#52675e]">
                        {statusLabels[restriction.status]}
                      </span>
                    </p>
                    <p className="mt-1 text-[#52675e]">
                      {formatDateRange(
                        restriction.startDate,
                        restriction.endDate,
                      )}{' '}
                      · {restriction.reason}
                    </p>
                    <p className="mt-1 text-[#70857b]">
                      By {restriction.createdBy.fullName}
                      {restriction.liftedBy &&
                        `; lifted by ${restriction.liftedBy.fullName}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}
