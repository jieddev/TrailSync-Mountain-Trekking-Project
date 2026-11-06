import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AuthFormField from '../components/AuthFormField'
import AuthPageLayout from '../components/AuthPageLayout'
import AuthSubmitButton from '../components/AuthSubmitButton'
import {
  composeFullName,
  type FormErrors,
  getPasswordStrength,
  MIN_ACCOUNT_AGE,
  type RegisterFormValues,
  validateOtpCode,
  validateRegisterForm,
} from '../validation'

import {
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'

import { auth } from '../../../lib/firebase'
import {
  requestVerificationCode,
  verifyEmailCode,
} from '../../../lib/email-verification-api'
import { ApiError, createUser } from '../../../lib/users-api'
import { TERMS_VERSION } from '../../legal/agreements'
import AgreementCheckbox from '../../legal/components/AgreementCheckbox'

const RESEND_WAIT_SECONDS = 60

// Friendly text for the email-code errors; the backend's own text is never shown.
const codeMessageByApiCode: Record<string, string> = {
  ACCOUNT_EXISTS: 'An account already exists with this email.',
  CODE_EXPIRED: 'This code has expired. Send a new code.',
  CODE_INCORRECT: 'That code is incorrect. Check the email and try again.',
  CODE_NOT_FOUND: 'Send a code to your email first.',
  EMAIL_NOT_VERIFIED: 'Verify your email before creating an account.',
  RESEND_TOO_SOON: 'Please wait a moment before sending another code.',
  TOO_MANY_ATTEMPTS: 'Too many incorrect codes. Send a new code.',
}

const initialValues: RegisterFormValues = {
  acceptedTerms: false,
  age: '',
  confirmPassword: '',
  email: '',
  firstName: '',
  lastName: '',
  middleName: '',
  password: '',
  suffix: '',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<RegisterFormValues>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [hasInteractedWithPassword, setHasInteractedWithPassword] =
    useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Sign-up is two steps: the details form, then the code emailed to the hiker.
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string>()
  const [resendSeconds, setResendSeconds] = useState(0)
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setTimeout(
      () => setResendSeconds((seconds) => seconds - 1),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { checked, name, type, value } = event.target
    const nextValues = {
      ...values,
      [name]: type === 'checkbox' ? checked : value,
    } as RegisterFormValues

    setValues(nextValues)
    if (hasSubmitted) {
      setErrors(validateRegisterForm(nextValues))
    } else if (name === 'password') {
      setHasInteractedWithPassword(true)
      setErrors((currentErrors) => ({
        ...currentErrors,
        password: validateRegisterForm(nextValues).password,
      }))
    }
  }

  function handlePasswordBlur() {
    if (!hasInteractedWithPassword) return

    setErrors((currentErrors) => ({
      ...currentErrors,
      password: validateRegisterForm(values).password,
    }))
  }

  const passwordStrength = getPasswordStrength(values.password)
  const strengthStyles = {
    Weak: {
      bar: 'bg-rose-500',
      label: 'text-rose-600',
      width: 'w-1/3',
    },
    Fair: {
      bar: 'bg-amber-500',
      label: 'text-amber-600',
      width: 'w-2/3',
    },
    Strong: {
      bar: 'bg-[#008755]',
      label: 'text-[#007e4f]',
      width: 'w-full',
    },
  }

  function apiErrorMessage(error: unknown, fallback: string) {
    if (error instanceof ApiError) {
      return (error.code && codeMessageByApiCode[error.code]) || error.message
    }
    return fallback
  }

  async function sendCode() {
    try {
      await requestVerificationCode(values.email.trim())
      setResendSeconds(RESEND_WAIT_SECONDS)
      return true
    } catch (error) {
      // A code sent moments ago is still valid, so let the hiker enter it.
      if (error instanceof ApiError && error.code === 'RESEND_TOO_SOON') {
        setResendSeconds(RESEND_WAIT_SECONDS)
        return true
      }
      console.log(error)
      setFormError(
        apiErrorMessage(
          error,
          'Could not send the verification code. Check your connection and try again.',
        ),
      )
      return false
    }
  }

  async function handleDetailsSubmit() {
    setHasSubmitted(true)
    const validationErrors = validateRegisterForm(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return

    setIsLoading(true)
    try {
      if (await sendCode()) {
        setCode('')
        setCodeError(undefined)
        setStep('code')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setFormError('')
    setSuccessMessage('')
    setCodeError(undefined)
    setIsResending(true)
    try {
      if (await sendCode()) {
        setCode('')
        setSuccessMessage('We sent a new code. Check your inbox.')
      }
    } finally {
      setIsResending(false)
    }
  }

  function handleChangeEmail() {
    setStep('details')
    setCode('')
    setCodeError(undefined)
    setFormError('')
    setSuccessMessage('')
  }

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    const nextCode = event.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(nextCode)
    if (codeError) setCodeError(validateOtpCode(nextCode))
  }

  async function handleCodeSubmit() {
    const error = validateOtpCode(code)
    setCodeError(error)
    if (error) return

    setIsLoading(true)

    try {
      await verifyEmailCode(values.email.trim(), code)
    } catch (error) {
      console.log(error)
      setFormError(
        apiErrorMessage(
          error,
          'Could not check the code. Check your connection and try again.',
        ),
      )
      setIsLoading(false)
      return
    }

    try {
      await createAccount()
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSuccessMessage('')

    if (step === 'details') {
      await handleDetailsSubmit()
    } else {
      await handleCodeSubmit()
    }
  }

  // Runs after the emailed code is verified: Firebase login, then the TrailSync profile.
  async function createAccount() {
    try {
      const registeredEmail = values.email.trim()
      const credential = await createUserWithEmailAndPassword(
        auth,
        registeredEmail,
        values.password,
      )

      await updateProfile(credential.user, {
        displayName: composeFullName(values),
      })

      await createUser({
        acceptedTermsVersion: TERMS_VERSION,
        age: Number(values.age),
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        suffix: values.suffix,
        idToken: await credential.user.getIdToken(),
      })

      await signOut(auth)

      navigate('/login', {
        replace: true,
        state: {
          email: registeredEmail,
          successMessage:
            'Account created successfully! Please log in to continue.',
        },
      })
    } catch (error) {
      console.log(error)

      if (error instanceof ApiError) {
        setFormError(apiErrorMessage(error, error.message))
        return
      }

      const errorCode = (error as { code?: string }).code

      const messageByCode: Record<string, string> = {
        'auth/email-already-in-use':
          'An account already exists with this email.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Choose a stronger password.',
        'auth/network-request-failed':
          'Network error. Check your connection and try again.',
      }

      setFormError(
        messageByCode[errorCode ?? ''] ??
          'Could not create your account. Please try again.',
      )
    }
  }

  return (
    <AuthPageLayout
      description="Create your account and start planning your next TrailSync trekking experience."
      footerPrompt="Already have an account?"
      footerText="Log in"
      footerTo="/login"
      formTitle="Create your account."
      title="Start your TrailSync journey."
    >
      <form className="space-y-3" noValidate onSubmit={handleSubmit}>
        <div
          aria-live="polite"
          className={formError ? 'text-sm text-rose-600' : 'hidden'}
        >
          {formError}
        </div>
        <div
          aria-live="polite"
          className={successMessage ? 'text-sm text-[#007e4f]' : 'hidden'}
        >
          {successMessage}
        </div>
        {step === 'code' ? (
          <>
            <p className="text-sm text-[#52675e]">
              We sent a 6-digit code to{' '}
              <span className="font-bold text-[#173a2e]">
                {values.email.trim()}
              </span>
              . It expires in 10 minutes. If you don't see it, check your spam
              folder.
            </p>
            <AuthFormField
              autoComplete="one-time-code"
              error={codeError}
              id="verification-code"
              inputMode="numeric"
              label="Verification code"
              name="code"
              onChange={handleCodeChange}
              placeholder="123456"
              type="text"
              value={code}
            />
            <AuthSubmitButton
              isLoading={isLoading}
              label="Verify & create account"
            />
            <div className="flex items-center justify-between pt-1 text-sm">
              <button
                className="cursor-pointer font-bold text-[#007e4f] hover:underline disabled:cursor-not-allowed disabled:text-[#83958c] disabled:no-underline"
                disabled={resendSeconds > 0 || isResending || isLoading}
                onClick={handleResend}
                type="button"
              >
                {resendSeconds > 0
                  ? `Resend code in ${resendSeconds}s`
                  : isResending
                    ? 'Sending…'
                    : 'Resend code'}
              </button>
              <button
                className="cursor-pointer font-bold text-[#52675e] hover:underline disabled:cursor-not-allowed"
                disabled={isLoading}
                onClick={handleChangeEmail}
                type="button"
              >
                Change email
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <AuthFormField
                autoComplete="given-name"
                error={errors.firstName}
                id="first-name"
                label="First name"
                name="firstName"
                onChange={handleChange}
                placeholder="e.g. Juan"
                type="text"
                value={values.firstName}
              />
              <AuthFormField
                autoComplete="family-name"
                error={errors.lastName}
                id="last-name"
                label="Last name"
                name="lastName"
                onChange={handleChange}
                placeholder="e.g. Dela Cruz"
                type="text"
                value={values.lastName}
              />
            </div>
            <div className="grid gap-x-3 sm:grid-cols-[1fr_7rem]">
              <AuthFormField
                autoComplete="additional-name"
                error={errors.middleName}
                id="middle-name"
                label="Middle name (optional)"
                name="middleName"
                onChange={handleChange}
                placeholder="e.g. Santos"
                type="text"
                value={values.middleName}
              />
              <AuthFormField
                autoComplete="honorific-suffix"
                error={errors.suffix}
                id="suffix"
                label="Suffix (optional)"
                name="suffix"
                onChange={handleChange}
                placeholder="Jr., III"
                type="text"
                value={values.suffix}
              />
            </div>
            <AuthFormField
              autoComplete="off"
              error={errors.age}
              hint={`You must be ${MIN_ACCOUNT_AGE} or older. We use this when you book a trek.`}
              id="age"
              inputMode="numeric"
              label="Age"
              name="age"
              onChange={handleChange}
              placeholder="Enter your age"
              type="text"
              value={values.age}
            />
            <AuthFormField
              autoComplete="email"
              error={errors.email}
              id="email"
              label="Email address"
              name="email"
              onChange={handleChange}
              placeholder="name@example.com"
              type="email"
              value={values.email}
            />
            <AuthFormField
              autoComplete="new-password"
              error={errors.password}
              id="password"
              label="Password"
              name="password"
              onBlur={handlePasswordBlur}
              onChange={handleChange}
              placeholder="Create a password"
              supplemental={
                passwordStrength ? (
                  <div className="pt-2" role="status">
                    <p className="text-sm text-[#52675e]">
                      Password strength:{' '}
                      <span className={strengthStyles[passwordStrength].label}>
                        {passwordStrength}
                      </span>
                    </p>
                    <div
                      aria-hidden="true"
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#dce8e1]"
                    >
                      <div
                        className={`h-full rounded-full ${strengthStyles[passwordStrength].bar} ${strengthStyles[passwordStrength].width}`}
                      />
                    </div>
                  </div>
                ) : null
              }
              trailingAction={
                <button
                  aria-label={
                    isPasswordVisible ? 'Hide password' : 'Show password'
                  }
                  className="rounded-sm p-1 text-[#70857b] outline-none hover:text-[#173a2e] focus-visible:ring-2 focus-visible:ring-[#008755]"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  {isPasswordVisible ? <HiddenEyeIcon /> : <EyeIcon />}
                </button>
              }
              type={isPasswordVisible ? 'text' : 'password'}
              value={values.password}
            />
            <AuthFormField
              autoComplete="new-password"
              error={errors.confirmPassword}
              id="confirm-password"
              label="Confirm password"
              name="confirmPassword"
              onChange={handleChange}
              placeholder="Confirm your password"
              trailingAction={
                <button
                  aria-label={
                    isConfirmPasswordVisible
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  className="rounded-sm p-1 text-[#70857b] outline-none hover:text-[#173a2e] focus-visible:ring-2 focus-visible:ring-[#008755]"
                  onClick={() =>
                    setIsConfirmPasswordVisible((visible) => !visible)
                  }
                  type="button"
                >
                  {isConfirmPasswordVisible ? <HiddenEyeIcon /> : <EyeIcon />}
                </button>
              }
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              value={values.confirmPassword}
            />
            <AgreementCheckbox
              checked={values.acceptedTerms}
              error={errors.acceptedTerms}
              id="accepted-terms"
              name="acceptedTerms"
              onChange={handleChange}
            >
              {(link) => (
                <>
                  I am 18 or older and agree to the{' '}
                  {link('terms', 'Terms of Use')} and{' '}
                  {link('privacy', 'Privacy Policy')}.
                </>
              )}
            </AgreementCheckbox>
            <AuthSubmitButton
              isLoading={isLoading}
              label="Send verification code"
            />
          </>
        )}
      </form>
    </AuthPageLayout>
  )
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function HiddenEyeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M3 3l18 18M10.6 6.2A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a16.2 16.2 0 0 1-3.1 3.8M6.2 6.2A16.3 16.3 0 0 0 2.5 12s3.5 6 9.5 6c1 0 2-.2 2.9-.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
