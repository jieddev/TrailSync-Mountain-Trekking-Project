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

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value } as RegisterFormValues

    setValues(nextValues)
    if (hasSubmitted) {
      setErrors(validateRegisterForm(nextValues))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setHasSubmitted(true)
    setErrors(validateRegisterForm(values))
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
        <div aria-live="polite" className="min-h-5 text-sm text-rose-300" />
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
        <AuthSubmitButton label="Create account" />
      </form>
    </AuthPageLayout>
  )
}
