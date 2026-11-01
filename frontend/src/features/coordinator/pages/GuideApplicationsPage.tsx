import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import {
  approveGuideApplication,
  declineGuideApplication,
  listGuideApplications,
  type GuideApplication,
  type GuideApplicationStatus,
} from '../../../lib/coordinator-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusBadge from '../../booking/components/StatusBadge'
import StatusCard from '../../booking/components/StatusCard'
import type { StatusTone } from '../../booking/lib/booking-status'
import { useCoordinatorSummary } from '../lib/coordinator-summary'

const tabs: { status: GuideApplicationStatus; label: string; empty: string }[] =
  [
    {
      status: 'PENDING',
      label: 'Pending',
      empty: 'No guide account requests are waiting for review.',
    },
    {
      status: 'APPROVED',
      label: 'Approved',
      empty: 'No guide account requests have been approved yet.',
    },
    {
      status: 'DECLINED',
      label: 'Declined',
      empty: 'No guide account requests have been declined.',
    },
  ]

const statusBadge: Record<
  GuideApplicationStatus,
  { label: string; tone: StatusTone }
> = {
  PENDING: { label: 'Pending review', tone: 'pending' },
  APPROVED: { label: 'Approved', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'declined' },
}

const MAX_DECLINE_REASON_LENGTH = 500

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; applications: GuideApplication[] }
  | { status: 'error' }

type Notice = { tone: 'success' | 'error'; text: string }

const primaryButtonClass =
  'rounded-lg bg-[#477a69] px-4 py-2 text-sm font-bold text-white hover:bg-[#3a6457] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButtonClass =
  'rounded-lg border border-[#d5e1da] bg-white px-4 py-2 text-sm font-bold text-[#173a2e] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] disabled:opacity-60'
const dangerButtonClass =
  'rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function GuideApplicationsPage() {
  const { user } = useAuth()
  const { refresh: refreshSummary } = useCoordinatorSummary()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab =
    tabs.find((tab) => tab.status === searchParams.get('status')) ?? tabs[0]
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    async function loadApplications() {
      setState({ status: 'loading' })
      try {
        const idToken = await user!.getIdToken()
        const applications = await listGuideApplications(
          idToken,
          activeTab.status,
        )
        if (isCurrent) setState({ status: 'loaded', applications })
      } catch {
        if (isCurrent) setState({ status: 'error' })
      }
    }

    void loadApplications()
    return () => {
      isCurrent = false
    }
  }, [user, activeTab.status, reloadKey])

  // A reviewed request leaves the Pending tab; it shows up under its new status.
  function handleReviewed(application: GuideApplication) {
    setState((current) =>
      current.status === 'loaded'
        ? {
            status: 'loaded',
            applications: current.applications.filter(
              (item) => item.id !== application.id,
            ),
          }
        : current,
    )
    setNotice({
      tone: 'success',
      text:
        application.status === 'APPROVED'
          ? `${application.fullName}’s guide account was created. They can now sign in to the guide app.`
          : `${application.fullName}’s request was declined.`,
    })
  }

  function handleReviewFailed(error: unknown) {
    if (error instanceof ApiError && error.code === 'ACCOUNT_EXISTS') {
      setNotice({
        tone: 'error',
        text: 'A TrailSync account already exists for this guide’s login or email, so a guide account could not be created.',
      })
    } else if (
      error instanceof ApiError &&
      (error.code === 'APPLICATION_NOT_PENDING' ||
        error.code === 'APPLICATION_NOT_FOUND')
    ) {
      setNotice({
        tone: 'error',
        text: 'This request was already reviewed. Showing the latest list.',
      })
      setReloadKey((key) => key + 1)
      refreshSummary()
    } else {
      setNotice({
        tone: 'error',
        text: 'We couldn’t update this request. Please try again.',
      })
    }
  }

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Guide account requests">
        Review trek guides who registered in the guide app. Approving a request
        creates their guide account; declining it keeps them out. Oldest
        requests are listed first.
      </PageHeader>

      <div
        aria-label="Request status"
        className="mb-5 inline-flex rounded-xl border border-[#d5e1da] bg-white p-1"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-selected={tab.status === activeTab.status}
            className={`rounded-lg px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${tab.status === activeTab.status ? 'bg-[#477a69] text-white' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`}
            key={tab.status}
            onClick={() => {
              setNotice(null)
              setSearchParams({ status: tab.status })
            }}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <p
          className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-[#b9d8c8] bg-[#eef7f1] text-[#006b43]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}

      {state.status === 'loading' && (
        <StatusCard role="status">Loading guide account requests…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Requests couldn’t load">
          We couldn’t load the guide account requests. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.applications.length === 0 && (
        <StatusCard title="Nothing here">{activeTab.empty}</StatusCard>
      )}
      {state.status === 'loaded' && state.applications.length > 0 && (
        <ul className="grid gap-3">
          {state.applications.map((application) => (
            <ApplicationCard
              application={application}
              key={application.id}
              onReviewFailed={handleReviewFailed}
              onReviewed={handleReviewed}
              onReviewStarted={() => setNotice(null)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

type ApplicationCardProps = {
  application: GuideApplication
  onReviewed: (application: GuideApplication) => void
  onReviewFailed: (error: unknown) => void
  onReviewStarted: () => void
}

function ApplicationCard({
  application,
  onReviewed,
  onReviewFailed,
  onReviewStarted,
}: ApplicationCardProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<'idle' | 'approving' | 'declining'>('idle')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const badge = statusBadge[application.status]
  const reasonId = `decline-reason-${application.id}`

  async function submit(action: 'approve' | 'decline') {
    setIsSubmitting(true)
    onReviewStarted()
    try {
      const idToken = await user!.getIdToken()
      const reviewed =
        action === 'approve'
          ? await approveGuideApplication(idToken, application.id)
          : await declineGuideApplication(
              idToken,
              application.id,
              reason.trim() || undefined,
            )
      onReviewed(reviewed)
    } catch (error) {
      setIsSubmitting(false)
      setStep('idle')
      onReviewFailed(error)
    }
  }

  return (
    <li className="rounded-2xl border border-[#d5e1da] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-[#173a2e]">{application.fullName}</p>
          <a
            className="mt-1 block truncate text-sm text-[#007e4f] underline-offset-4 hover:underline"
            href={`mailto:${application.email}`}
          >
            {application.email}
          </a>
          <p className="mt-2 text-xs text-[#70857b]">
            Requested {formatDateTime(application.createdAt)}
          </p>
        </div>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>

      {application.status !== 'PENDING' && application.reviewedAt && (
        <p className="mt-3 text-sm text-[#52675e]">
          {application.status === 'APPROVED' ? 'Approved' : 'Declined'}{' '}
          {application.reviewedBy && `by ${application.reviewedBy.fullName} `}
          on {formatDateTime(application.reviewedAt)}
        </p>
      )}
      {application.status === 'DECLINED' && application.declineReason && (
        <p className="mt-2 text-sm text-[#52675e]">
          <span className="font-semibold text-[#173a2e]">Reason:</span>{' '}
          {application.declineReason}
        </p>
      )}

      {application.status === 'PENDING' && step === 'idle' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={primaryButtonClass}
            onClick={() => setStep('approving')}
            type="button"
          >
            Approve
          </button>
          <button
            className={secondaryButtonClass}
            onClick={() => setStep('declining')}
            type="button"
          >
            Decline
          </button>
        </div>
      )}

      {step === 'approving' && (
        <div className="mt-4 rounded-xl bg-[#f7f9f6] p-4">
          <p className="text-sm leading-6 text-[#52675e]">
            Create a guide account for {application.fullName}? They will be able
            to sign in to the guide app with {application.email}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={primaryButtonClass}
              disabled={isSubmitting}
              onClick={() => void submit('approve')}
              type="button"
            >
              {isSubmitting ? 'Creating account…' : 'Yes, create account'}
            </button>
            <button
              className={secondaryButtonClass}
              disabled={isSubmitting}
              onClick={() => setStep('idle')}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'declining' && (
        <div className="mt-4 rounded-xl bg-[#f7f9f6] p-4">
          <label
            className="text-sm font-semibold text-[#173a2e]"
            htmlFor={reasonId}
          >
            Reason for declining (optional)
          </label>
          <textarea
            className="mt-2 block w-full rounded-lg border border-[#d5e1da] bg-white px-3 py-2 text-sm text-[#173a2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
            disabled={isSubmitting}
            id={reasonId}
            maxLength={MAX_DECLINE_REASON_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            value={reason}
          />
          <p className="mt-1 text-xs text-[#70857b]">
            The guide sees this reason when they try to sign in.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={dangerButtonClass}
              disabled={isSubmitting}
              onClick={() => void submit('decline')}
              type="button"
            >
              {isSubmitting ? 'Declining…' : 'Decline request'}
            </button>
            <button
              className={secondaryButtonClass}
              disabled={isSubmitting}
              onClick={() => setStep('idle')}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
