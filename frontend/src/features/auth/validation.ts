export type LoginFormValues = {
  email: string
  password: string
}

export type RegisterFormValues = {
  acceptedTerms: boolean
  age: string
  confirmPassword: string
  email: string
  firstName: string
  lastName: string
  middleName: string
  password: string
  suffix: string
}

// Must match backend/src/lib/person-name.ts, which POST /users also enforces.
export const NAME_PART_MAX_LENGTH = 50
export const SUFFIX_MAX_LENGTH = 10

const cleanNamePart = (value: string) => value.trim().replace(/\s+/g, ' ')

// "Juan Santos Dela Cruz Jr.", the same way the backend builds fullName.
export function composeFullName(
  values: Pick<
    RegisterFormValues,
    'firstName' | 'middleName' | 'lastName' | 'suffix'
  >,
) {
  return [values.firstName, values.middleName, values.lastName, values.suffix]
    .map(cleanNamePart)
    .filter(Boolean)
    .join(' ')
}

// Must match MIN_BOOKING_OWNER_AGE in backend/src/lib/package-policy.ts, which
// POST /users also enforces. The age is saved and used as the booking owner's age.
export const MIN_ACCOUNT_AGE = 18

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

  if (!values.firstName.trim()) {
    errors.firstName = 'Enter your first name.'
  } else if (cleanNamePart(values.firstName).length > NAME_PART_MAX_LENGTH) {
    errors.firstName = `First name must be at most ${NAME_PART_MAX_LENGTH} characters.`
  }

  if (cleanNamePart(values.middleName).length > NAME_PART_MAX_LENGTH) {
    errors.middleName = `Middle name must be at most ${NAME_PART_MAX_LENGTH} characters.`
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Enter your last name.'
  } else if (cleanNamePart(values.lastName).length > NAME_PART_MAX_LENGTH) {
    errors.lastName = `Last name must be at most ${NAME_PART_MAX_LENGTH} characters.`
  }

  if (cleanNamePart(values.suffix).length > SUFFIX_MAX_LENGTH) {
    errors.suffix = `Suffix must be at most ${SUFFIX_MAX_LENGTH} characters.`
  }

  if (!/^\d+$/.test(values.age.trim()) || Number(values.age) <= 0) {
    errors.age = 'Enter your age as a whole number.'
  } else if (Number(values.age) < MIN_ACCOUNT_AGE) {
    errors.age = `You must be ${MIN_ACCOUNT_AGE} or older to create an account.`
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

// The one-time code emailed at sign-up: exactly 6 digits.
export function validateOtpCode(code: string): string | undefined {
  if (!code.trim()) return 'Enter the 6-digit code we emailed you.'
  if (!/^\d{6}$/.test(code.trim())) return 'The code is 6 digits.'
  return undefined
}
