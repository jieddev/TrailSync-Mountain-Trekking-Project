import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'

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

export default function LoginPage() {
  const [values, setValues] = useState<LoginFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
      await signInWithEmailAndPassword(auth, values.email.trim(), values.password)
      setSuccessMessage('You are now logged in.')
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
      description="Sign in to manage your TrailSync experience."
      footerPrompt="New to TrailSync?"
      footerText="Create an account"
      footerTo="/register"
      title="Welcome back"
    >
      <form className="mt-8 space-y-4" noValidate onSubmit={handleSubmit}>
        <div aria-live="polite" className="min-h-5 text-sm text-rose-300">
          {formError}
        </div>
        <div aria-live="polite" className="min-h-5 text-sm text-emerald-300">
          {successMessage}
        </div>
        <AuthFormField
          autoComplete="email"
          error={errors.email}
          id="email"
          label="Email address"
          name="email"
          onChange={handleChange}
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
          type="password"
          value={values.password}
        />
        <AuthSubmitButton isLoading={isLoading} label="Log in" />
      </form>
    </AuthPageLayout>
  )
}
