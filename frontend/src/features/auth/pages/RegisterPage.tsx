import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AuthFormField from '../components/AuthFormField'
import AuthPageLayout from '../components/AuthPageLayout'
import AuthSubmitButton from '../components/AuthSubmitButton'
import {
  type FormErrors,
  getPasswordStrength,
  MIN_ACCOUNT_AGE,
  type RegisterFormValues,
  validateRegisterForm,
} from '../validation'

import {
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'

import { auth } from '../../../lib/firebase'
import { ApiError, createUser } from '../../../lib/users-api'
import { TERMS_VERSION } from '../../legal/agreements'
import AgreementCheckbox from '../../legal/components/AgreementCheckbox'

const initialValues: RegisterFormValues = {
  acceptedTerms: false,
  age: '',
  confirmPassword: '',
  email: '',
  fullName: '',
  password: '',
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
      const registeredEmail = values.email.trim()
      const credential = await createUserWithEmailAndPassword(
        auth,
        registeredEmail,
        values.password,
      )

      await updateProfile(credential.user, {
        displayName: values.fullName.trim(),
      })

      await createUser({
        acceptedTermsVersion: TERMS_VERSION,
        age: Number(values.age),
        fullName: values.fullName.trim(),
        idToken: await credential.user.getIdToken(),
      })

      await signOut(auth)

      setValues(initialValues)
      setErrors({})
      setHasSubmitted(false)
      setHasInteractedWithPassword(false)
      setIsPasswordVisible(false)
      setIsConfirmPasswordVisible(false)
      setFormError('')
      setSuccessMessage('')

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
        setFormError(error.message)
        return
      }

      const code = (error as { code?: string }).code

      const messageByCode: Record<string, string> = {
        'auth/email-already-in-use':
          'An account already exists with this email.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Choose a stronger password.',
        'auth/network-request-failed':
          'Network error. Check your connection and try again.',
      }

      setFormError(
        messageByCode[code ?? ''] ??
          'Could not create your account. Please try again.',
      )
    } finally {
      setIsLoading(false)
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
        <AuthFormField
          autoComplete="name"
          error={errors.fullName}
          id="full-name"
          label="Full name"
          name="fullName"
          onChange={handleChange}
          placeholder="Enter your full name"
          type="text"
          value={values.fullName}
        />
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
              onClick={() => setIsConfirmPasswordVisible((visible) => !visible)}
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
              I am 18 or older and agree to the {link('terms', 'Terms of Use')}{' '}
              and {link('privacy', 'Privacy Policy')}.
            </>
          )}
        </AgreementCheckbox>
        <AuthSubmitButton isLoading={isLoading} label="Create account" />
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
