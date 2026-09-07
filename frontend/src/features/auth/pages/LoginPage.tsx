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

const initialValues: LoginFormValues = {
  email: '',
  password: '',
}

export default function LoginPage() {
  const [values, setValues] = useState<LoginFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value } as LoginFormValues

    setValues(nextValues)
    if (hasSubmitted) {
      setErrors(validateLoginForm(nextValues))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setHasSubmitted(true)
    setErrors(validateLoginForm(values))
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
        <div aria-live="polite" className="min-h-5 text-sm text-rose-300" />
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
        <AuthSubmitButton label="Log in" />
      </form>
    </AuthPageLayout>
  )
}
