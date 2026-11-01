import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import {
  listGuides,
  setGuideAvailability,
  type Guide,
} from '../../../lib/coordinator-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import { formatSchedule } from '../../booking/lib/booking-form'
import ConfirmAction from '../components/ConfirmAction'
import {
  dispatchErrorMessage,
  formatClockTime,
  type Notice,
} from '../lib/dispatch'
import { cardClass, primaryButtonClass } from '../lib/ui'
import { useCoordinatorSummary } from '../lib/coordinator-summary'

type GuidesState =
  | { status: 'loading' }
  | { status: 'loaded'; guides: Guide[] }
  | { status: 'error' }

export default function GuideQueuePage() {
  const { user } = useAuth()
  const { refresh: refreshSummary } = useCoordinatorSummary()
  const [state, setState] = useState<GuidesState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyGuideId, setBusyGuideId] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function loadGuides() {
      try {
        const idToken = await user!.getIdToken()
        const guides = await listGuides(idToken)
        if (isCurrent) setState({ status: 'loaded', guides })
      } catch {
        if (isCurrent) setState({ status: 'error' })
      }
    }

    void loadGuides()
    return () => {
      isCurrent = false
    }
  }, [user, reloadKey])

  async function changeAvailability(
    guide: Guide,
    status: 'AVAILABLE' | 'OFF_DUTY',
  ) {
    setNotice(null)
    setBusyGuideId(guide.id)
    try {
      const idToken = await user!.getIdToken()
      const updated = await setGuideAvailability(idToken, guide.id, status)
      setNotice({
        tone: 'success',
        text:
          status === 'AVAILABLE'
            ? `${guide.fullName} joined the queue at position ${updated.queuePosition}.`
            : `${guide.fullName} is off duty and left the queue.`,
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        text: dispatchErrorMessage(
          error,
          'We couldn’t update this guide. Please try again.',
        ),
      })
    } finally {
      setBusyGuideId(null)
      setReloadKey((key) => key + 1)
      refreshSummary()
    }
  }

  const guides = state.status === 'loaded' ? state.guides : []
  const queue = guides.filter((guide) => guide.dutyStatus === 'AVAILABLE')
  const onTrek = guides.filter((guide) => guide.dutyStatus === 'ASSIGNED')
  const offDuty = guides.filter((guide) => guide.dutyStatus === 'OFF_DUTY')

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Guide queue">
        Guides are dispatched first in, first out. Reporting in puts a guide at
        the end of the queue; check-in always takes the guide at the front. If
        the front guide isn’t at the office, mark them off duty.
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
        <StatusCard role="status">Loading guides…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Guides couldn’t load">
          We couldn’t load the guide queue. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && guides.length === 0 && (
        <StatusCard title="No guides yet">
          Guides appear here once their account request is approved.
        </StatusCard>
      )}
      {state.status === 'loaded' && guides.length > 0 && (
        <div className="grid gap-6">
          <section className={cardClass}>
            <h2 className="text-sm font-bold text-[#173a2e]">
              Queue ({queue.length})
            </h2>
            {queue.length === 0 ? (
              <p className="mt-3 text-sm text-[#52675e]">
                No guides are available. Groups that check in will wait until a
                guide reports in.
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-[#e7ece8]">
                {queue.map((guide) => (
                  <li
                    className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-start sm:justify-between"
                    key={guide.id}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-label={`Position ${guide.queuePosition}`}
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${guide.queuePosition === 1 ? 'bg-[#008755] text-white' : 'bg-[#e8f1eb] text-[#006b43]'}`}
                      >
                        {guide.queuePosition}
                      </span>
                      <div>
                        <p className="font-bold text-[#173a2e]">
                          {guide.fullName}
                          {guide.queuePosition === 1 && (
                            <span className="ml-2 rounded-full bg-[#e8f1eb] px-2 py-0.5 text-xs font-bold text-[#006b43]">
                              Next up
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-[#70857b]">
                          Available since{' '}
                          {formatClockTime(guide.availableSince!)}
                        </p>
                      </div>
                    </div>
                    <div className="sm:max-w-xs sm:text-right">
                      <ConfirmAction
                        busyLabel="Updating…"
                        confirmLabel="Yes, off duty"
                        label="Mark off duty"
                        onConfirm={() => changeAvailability(guide, 'OFF_DUTY')}
                        question={`Take ${guide.fullName} out of the queue? When they report in again they join at the end.`}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="text-sm font-bold text-[#173a2e]">
              On a trek ({onTrek.length})
            </h2>
            {onTrek.length === 0 ? (
              <p className="mt-3 text-sm text-[#52675e]">
                No guides are on the trail.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#e7ece8]">
                {onTrek.map((guide) => (
                  <li className="py-4 text-sm" key={guide.id}>
                    <p className="font-bold text-[#173a2e]">{guide.fullName}</p>
                    {guide.currentBooking && (
                      <p className="mt-1 text-[#52675e]">
                        <Link
                          className="font-semibold text-[#007e4f] underline-offset-4 hover:underline"
                          to={`/coordinator/bookings/${guide.currentBooking.id}`}
                        >
                          {guide.currentBooking.trail.name}
                        </Link>{' '}
                        ·{' '}
                        {formatSchedule(
                          guide.currentBooking.scheduledDate,
                          guide.currentBooking.scheduledTime,
                        )}
                      </p>
                    )}
                    <p className="mt-1 text-[#70857b]">
                      Rejoins the end of the queue when the trek is completed.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="text-sm font-bold text-[#173a2e]">
              Off duty ({offDuty.length})
            </h2>
            {offDuty.length === 0 ? (
              <p className="mt-3 text-sm text-[#52675e]">
                Every guide is on duty.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#e7ece8]">
                {offDuty.map((guide) => (
                  <li
                    className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                    key={guide.id}
                  >
                    <div>
                      <p className="font-bold text-[#173a2e]">
                        {guide.fullName}
                      </p>
                      <p className="mt-1 text-[#70857b]">{guide.email}</p>
                    </div>
                    <button
                      className={primaryButtonClass}
                      disabled={busyGuideId === guide.id}
                      onClick={() =>
                        void changeAvailability(guide, 'AVAILABLE')
                      }
                      type="button"
                    >
                      {busyGuideId === guide.id
                        ? 'Updating…'
                        : 'Mark available'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  )
}
