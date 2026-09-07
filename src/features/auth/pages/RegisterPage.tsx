import type { FormEvent } from 'react'

import AuthFormField from '../components/AuthFormField'
import AuthPageLayout from '../components/AuthPageLayout'
import AuthSubmitButton from '../components/AuthSubmitButton'

export default function RegisterPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
          id="full-name"
          label="Full name"
          type="text"
        />
        <AuthFormField
          autoComplete="email"
          id="email"
          label="Email address"
          type="email"
        />
        <AuthFormField
          autoComplete="new-password"
          id="password"
          label="Password"
          type="password"
        />
        <AuthFormField
          autoComplete="new-password"
          id="confirm-password"
          label="Confirm password"
          type="password"
        />
        <AuthSubmitButton label="Create account" />
      </form>
    </AuthPageLayout>
  )
}
