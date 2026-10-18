import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import AuthFormField from '../components/AuthFormField'
import AuthPageLayout from '../components/AuthPageLayout'
import AuthSubmitButton from '../components/AuthSubmitButton'
import {
  type FormErrors,
  type LoginFormValues,
  validateLoginForm,
} from '../validation'

import { signInWithEmailAndPassword } from 'firebase/auth'

import { auth } from '../../../lib/firebase'

const initialValues: LoginFormValues = {
  email: '',
  password: '',
}

type LoginNavigationState = {
  email?: string
  successMessage?: string
}

export default function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const registrationState = location.state as LoginNavigationState | null
  const [values, setValues] = useState<LoginFormValues>({
    ...initialValues,
    email: registrationState?.email ?? '',
  })
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState(
    registrationState?.successMessage ?? '',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value } as LoginFormValues

    setValues(nextValues)
    if (hasSubmitted) {
      setErrors(validateLoginForm(nextValues))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setHasSubmitted(true)
    const validationErrors = validateLoginForm(values)
    setErrors(validationErrors)
    setFormError('')
    setSuccessMessage('')

    if (Object.keys(validationErrors).length > 0) return

    setIsLoading(true)

    try {
      await signInWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      )
      // "/" sends each role to its own area (see RoleHome in App.tsx).
      navigate('/', { replace: true })
    } catch (error) {
      const code = (error as { code?: string }).code

      const messageByCode: Record<string, string> = {
        'auth/invalid-credential': 'Incorrect email address or password.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/network-request-failed':
          'Network error. Check your connection and try again.',
        'auth/too-many-requests':
          'Too many unsuccessful attempts. Please try again later.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'Incorrect email address or password.',
        'auth/wrong-password': 'Incorrect email address or password.',
      }

      setFormError(
        messageByCode[code ?? ''] ?? 'Could not log you in. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthPageLayout
      description="Sign in to continue planning and managing your TrailSync trekking experience."
      footerPrompt="New to TrailSync?"
      footerText="Create an account"
      footerTo="/register"
      formTitle="Sign in to TrailSync."
      title="Welcome back to TrailSync."
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
          autoComplete="current-password"
          error={errors.password}
          id="password"
          label="Password"
          name="password"
          onChange={handleChange}
          placeholder="Enter your password"
          trailingAction={
            <button
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
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
        <AuthSubmitButton isLoading={isLoading} label="Log in" />
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
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
