import type { FormEvent } from 'react'

import AuthFormField from '../components/AuthFormField'
import AuthPageLayout from '../components/AuthPageLayout'
import AuthSubmitButton from '../components/AuthSubmitButton'

export default function LoginPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
          id="email"
          label="Email address"
          type="email"
        />
        <AuthFormField
          autoComplete="current-password"
          id="password"
          label="Password"
          type="password"
        />
        <AuthSubmitButton label="Log in" />
      </form>
    </AuthPageLayout>
  )
}
