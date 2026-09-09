import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'

import AuthFormField from '../components/AuthFormField'
import AuthPageLayout from '../components/AuthPageLayout'
import AuthSubmitButton from '../components/AuthSubmitButton'
import {
  type FormErrors,
  type RegisterFormValues,
  validateRegisterForm,
} from '../validation'

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'

import {auth} from '../../../lib/firebase'

const initialValues: RegisterFormValues = {
  confirmPassword: '',
  email: '',
  fullName: '',
  password: '',
}

export default function RegisterPage() {
  const [values, setValues] = useState<RegisterFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<RegisterFormValues>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value } as RegisterFormValues

    setValues(nextValues)
    if (hasSubmitted) {
      setErrors(validateRegisterForm(nextValues))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setHasSubmitted(true)
    const validationErrors = validateRegisterForm(values)
    setErrors(validationErrors)
    setFormError('')
    setSuccessMessage('')

    if (Object.keys(validationErrors).length > 0) return

    setIsLoading(true)

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      )

      await updateProfile(credential.user, {
        displayName: values.fullName.trim(),
      })

      setSuccessMessage('Successful registration')
    } catch (error) {
      console.log(error)
      const code = (error as {code?: string}).code

      const messageByCode: Record<string, string> = {
        'auth/email-already-in-use': 'An account already exists with this email.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Choose a stronger password.',
        'auth/network-request-failed':
          'Network error. Check your connection and try again.',
      }

      setFormError(messageByCode[code ?? ''] ?? 'Could not create your account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthPageLayout
      description="Create your TrailSync account to begin planning your next trek."
      footerPrompt="Already have an account?"
      footerText="Log in"
      footerTo="/login"
      title="Create an account"
    >
      <form className="mt-8 space-y-4" noValidate onSubmit={handleSubmit}>
        <div aria-live="polite" className="min-h-5 text-sm text-rose-300">
          {formError}
        </div>
        <div aria-live="polite" className="min-h-5 text-sm text-emerald-300">
          {successMessage}
        </div>
        <AuthFormField
          autoComplete="name"
          error={errors.fullName}
          id="full-name"
          label="Full name"
          name="fullName"
          onChange={handleChange}
          type="text"
          value={values.fullName}
        />
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
          autoComplete="new-password"
          error={errors.password}
          hint="Final password requirements are enforced by the authentication system."
          id="password"
          label="Password"
          name="password"
          onChange={handleChange}
          type="password"
          value={values.password}
        />
        <AuthFormField
          autoComplete="new-password"
          error={errors.confirmPassword}
          id="confirm-password"
          label="Confirm password"
          name="confirmPassword"
          onChange={handleChange}
          type="password"
          value={values.confirmPassword}
        />
        <AuthSubmitButton isLoading={isLoading} label="Create account" />
      </form>
    </AuthPageLayout>
  )
}
