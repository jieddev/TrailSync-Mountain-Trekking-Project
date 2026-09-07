export type LoginFormValues = {
  email: string
  password: string
}

export type RegisterFormValues = {
  confirmPassword: string
  email: string
  fullName: string
  password: string
}

export type FormErrors<T> = Partial<Record<keyof T, string>>

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateEmail(email: string) {
  if (!email.trim()) {
    return 'Enter your email address.'
  }

  if (!isValidEmail(email)) {
    return 'Enter a valid email address.'
  }

  return undefined
}

export function validateLoginForm(
  values: LoginFormValues,
): FormErrors<LoginFormValues> {
  const errors: FormErrors<LoginFormValues> = {}
  const emailError = validateEmail(values.email)

  if (emailError) {
    errors.email = emailError
  }

  if (!values.password) {
    errors.password = 'Enter your password.'
  }

  return errors
}

export function validateRegisterForm(
  values: RegisterFormValues,
): FormErrors<RegisterFormValues> {
  const errors: FormErrors<RegisterFormValues> = {}
  const emailError = validateEmail(values.email)

  if (!values.fullName.trim()) {
    errors.fullName = 'Enter your full name.'
  }

  if (emailError) {
    errors.email = emailError
  }

  // Password strength rules are intentionally deferred to the authentication system.
  if (!values.password) {
    errors.password = 'Enter a password.'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}
