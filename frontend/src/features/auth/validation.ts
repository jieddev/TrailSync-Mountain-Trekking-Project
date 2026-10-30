export type LoginFormValues = {
  email: string
  password: string
}

export type RegisterFormValues = {
  acceptedTerms: boolean
  confirmPassword: string
  email: string
  fullName: string
  password: string
}

export type FormErrors<T> = Partial<Record<keyof T, string>>

export type PasswordStrength = 'Weak' | 'Fair' | 'Strong'

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

export function getPasswordStrength(
  password: string,
): PasswordStrength | undefined {
  if (!password) {
    return undefined
  }

  const hasLowercase = /[a-z]/.test(password)
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password)
  const characterVariety = [
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecialCharacter,
  ].filter(Boolean).length
  const hasObviousWeakPattern =
    /(.)\1{2,}/.test(password) ||
    /(password|qwerty|12345|abcdef)/i.test(password)

  if (password.length < 8 || hasObviousWeakPattern) {
    return 'Weak'
  }

  if (password.length >= 12 && characterVariety >= 3) {
    return 'Strong'
  }

  if (characterVariety >= 2) {
    return 'Fair'
  }

  return 'Weak'
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

  if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  if (!values.acceptedTerms) {
    errors.acceptedTerms =
      'Confirm you are 18 or older and agree to the Terms of Use and Privacy Policy.'
  }

  return errors
}
