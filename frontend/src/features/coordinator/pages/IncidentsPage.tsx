import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import {
  acknowledgeIncident,
  listIncidents,
  mapsUrl,
  resolveIncident,
  type Incident,
} from '../../../lib/incidents-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import { formatSchedule } from '../../booking/lib/booking-form'
import type { Notice } from '../lib/dispatch'
import { cardClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui'
import { INCIDENT_POLL_MS, usePollingTick } from '../lib/use-polling'
import { useCoordinatorSummary } from '../lib/coordinator-summary'

const MAX_NOTE_LENGTH = 500

type PageState =
  | { status: 'loading' }
  | { status: 'loaded'; incidents: Incident[]; loadedAt: Date }
  | { status: 'error' }

const timeFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
})
const dateTimeFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

// "just now", "12 min ago", "3 h ago".
function age(iso: string, now: Date) {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

const refusalMessages: Record<string, string> = {
  INCIDENT_ALREADY_ACKNOWLEDGED:
    'Another coordinator already acknowledged this SOS. Showing the latest list.',
  INCIDENT_ALREADY_RESOLVED:
    'This incident was already resolved. Showing the latest list.',
  INCIDENT_NOT_FOUND: 'This incident no longer exists.',
}

function IncidentDetails({ incident, now }: { incident: Incident; now: Date }) {
  const { booking, location } = incident
  return (
    <div className="min-w-0 text-sm">
      <p className="font-bold text-[#173a2e]">
        {booking.trail.name} · guide {incident.guide.fullName}
      </p>
      <p className="mt-1 text-[#52675e]">
        SOS sent {dateTimeFormat.format(new Date(incident.createdAt))} (
        {age(incident.createdAt, now)}) · group of {booking.participantCount},
        booked by {booking.owner.fullName} for{' '}
        {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
      </p>
      {incident.note && (
        <p className="mt-2 text-[#173a2e]">“{incident.note}”</p>
      )}
      <p className="mt-2">
        {location ? (
          <>
            <a
              className="font-bold text-[#007e4f] underline-offset-4 hover:underline"
              href={mapsUrl(location)}
              rel="noreferrer"
              target="_blank"
            >
              Open last known location in Google Maps
            </a>
            <span className="text-[#70857b]">
              {' '}
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {location.accuracyM !== null &&
                ` · ±${Math.round(location.accuracyM)} m`}
              {location.recordedAt && ` · fix ${age(location.recordedAt, now)}`}
            </span>
          </>
        ) : (
          <span className="text-[#7a5300]">
            No location was sent. Contact the guide directly.
          </span>
        )}
      </p>
      <p className="mt-2">
        <Link
          className="font-bold text-[#007e4f] underline-offset-4 hover:underline"
          to={`/coordinator/bookings/${encodeURIComponent(booking.id)}`}
        >
          View booking
        </Link>
      </p>
    </div>
  )
}

type ResolveFormProps = {
  onResolve: (note: string) => Promise<boolean>
}

function ResolveForm({ onResolve }: ResolveFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const noteId = useId()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return setError('Describe how the incident was resolved.')
    if (trimmed.length > MAX_NOTE_LENGTH)
      return setError(`Use at most ${MAX_NOTE_LENGTH} characters.`)
    setError('')
    setIsSaving(true)
    const resolved = await onResolve(trimmed)
    setIsSaving(false)
    if (resolved) setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        className={secondaryButtonClass}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Resolve
      </button>
    )
  }

  return (
    <form className="w-full sm:w-72" noValidate onSubmit={handleSubmit}>
      <label
        className="block text-left text-sm font-bold text-[#173a2e]"
        htmlFor={noteId}
      >
        How was it resolved?
      </label>
      <textarea
        aria-describedby={error ? `${noteId}-error` : undefined}
        aria-invalid={Boolean(error)}
        className="mt-2 w-full rounded-lg border border-[#d5e1da] bg-white px-3 py-2 text-sm text-[#173a2e] focus:border-[#008755] focus:outline-none focus:ring-2 focus:ring-[#008755]/30"
        id={noteId}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        value={note}
      />
      {error && (
        <p
          className="mt-1 text-left text-sm text-rose-600"
          id={`${noteId}-error`}
        >
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
        <button
          className={primaryButtonClass}
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? 'Resolving…' : 'Mark resolved'}
        </button>
        <button
          className={secondaryButtonClass}
          disabled={isSaving}
          onClick={() => setIsOpen(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function IncidentsPage() {
  const { user } = useAuth()
  const { refresh: refreshSummary } = useCoordinatorSummary()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const tick = usePollingTick(INCIDENT_POLL_MS)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const idToken = await user!.getIdToken()
        const incidents = await listIncidents(idToken)
        if (isCurrent)
          setState({ status: 'loaded', incidents, loadedAt: new Date() })
      } catch {
        // Keep showing the last list if a background refresh fails.
        if (isCurrent)
          setState((current) =>
            current.status === 'loaded' ? current : { status: 'error' },
          )
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [user, reloadKey, tick])

  function refusal(error: unknown, fallback: string) {
    return error instanceof ApiError && error.code
      ? (refusalMessages[error.code] ?? fallback)
      : fallback
  }

  async function acknowledge(incident: Incident) {
    setNotice(null)
    setBusyId(incident.id)
    try {
      const idToken = await user!.getIdToken()
      await acknowledgeIncident(idToken, incident.id)
      setNotice({
        tone: 'success',
        text: `SOS from ${incident.guide.fullName} acknowledged. The guide's app shows that you have seen it.`,
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        text: refusal(
          error,
          'We couldn’t acknowledge this SOS. Please try again.',
        ),
      })
    } finally {
      setBusyId(null)
      setReloadKey((key) => key + 1)
      refreshSummary()
    }
  }

  async function resolve(incident: Incident, note: string) {
    setNotice(null)
    try {
      const idToken = await user!.getIdToken()
      await resolveIncident(idToken, incident.id, note)
      setNotice({
        tone: 'success',
        text: `Incident on ${incident.booking.trail.name} resolved.`,
      })
      setReloadKey((key) => key + 1)
      refreshSummary()
      return true
    } catch (error) {
      setNotice({
        tone: 'error',
        text: refusal(
          error,
          'We couldn’t resolve this incident. Please try again.',
        ),
      })
      setReloadKey((key) => key + 1)
      refreshSummary()
      return false
    }
  }

  const incidents = state.status === 'loaded' ? state.incidents : []
  const active = incidents.filter((incident) => incident.status !== 'RESOLVED')
  const resolved = incidents.filter(
    (incident) => incident.status === 'RESOLVED',
  )
  const now = state.status === 'loaded' ? state.loadedAt : new Date()

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Incidents">
        SOS alerts sent by guides from the trail. Acknowledge an SOS as soon as
        you see it so the guide knows help is coming, then resolve it with a
        note once the group is safe. The booking itself is not changed.
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
        <StatusCard role="status">Loading incidents…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Incidents couldn’t load">
          We couldn’t load incidents. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && (
        <div className="grid gap-6">
          <section aria-live="polite" className={cardClass}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-[#173a2e]">
                Needs attention ({active.length})
              </h2>
              <p className="text-xs text-[#70857b]">
                Checks for new SOS alerts every {INCIDENT_POLL_MS / 1000}{' '}
                seconds · updated {timeFormat.format(state.loadedAt)}
              </p>
            </div>
            {active.length === 0 ? (
              <p className="mt-3 text-sm text-[#52675e]">No open SOS alerts.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#e7ece8]">
                {active.map((incident) => (
                  <li
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                    key={incident.id}
                  >
                    <div className="min-w-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${incident.status === 'OPEN' ? 'bg-rose-50 text-rose-700' : 'bg-[#fdf3dc] text-[#7a5300]'}`}
                      >
                        {incident.status === 'OPEN'
                          ? 'New SOS'
                          : `Acknowledged by ${incident.acknowledgedBy?.fullName ?? 'a coordinator'}`}
                      </span>
                      <div className="mt-2">
                        <IncidentDetails incident={incident} now={now} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      {incident.status === 'OPEN' && (
                        <button
                          className={primaryButtonClass}
                          disabled={busyId === incident.id}
                          onClick={() => void acknowledge(incident)}
                          type="button"
                        >
                          {busyId === incident.id
                            ? 'Acknowledging…'
                            : 'Acknowledge'}
                        </button>
                      )}
                      <ResolveForm
                        onResolve={(note) => resolve(incident, note)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {resolved.length > 0 && (
            <section className={cardClass}>
              <h2 className="text-sm font-bold text-[#173a2e]">Resolved</h2>
              <ul className="mt-3 divide-y divide-[#e7ece8]">
                {resolved.map((incident) => (
                  <li className="py-4" key={incident.id}>
                    <IncidentDetails incident={incident} now={now} />
                    <p className="mt-2 text-sm text-[#52675e]">
                      Resolved by{' '}
                      {incident.resolvedBy?.fullName ?? 'a coordinator'}
                      {incident.resolvedAt &&
                        ` on ${dateTimeFormat.format(new Date(incident.resolvedAt))}`}
                      : {incident.resolutionNote}
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
