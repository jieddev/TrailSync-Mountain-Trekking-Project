import { describe, expect, it } from 'vitest'

import {
  composeFullName,
  getPasswordStrength,
  validateLoginForm,
  validateOtpCode,
  validateRegisterForm,
} from './validation'

describe('getPasswordStrength', () => {
  it('returns undefined for an empty password', () => {
    expect(getPasswordStrength('')).toBeUndefined()
  })

  it('identifies short passwords and obvious patterns as weak', () => {
    expect(getPasswordStrength('Ab1!def')).toBe('Weak')
    expect(getPasswordStrength('Password123!')).toBe('Weak')
  })

  it('identifies passwords with two character types as fair', () => {
    expect(getPasswordStrength('mountain1')).toBe('Fair')
  })

  it('identifies long passwords with three character types as strong', () => {
    expect(getPasswordStrength('TrailSync2026!')).toBe('Strong')
  })
})

describe('validateLoginForm', () => {
  it('accepts a valid email and non-empty password', () => {
    expect(
      validateLoginForm({
        email: 'hiker@example.com',
        password: 'any-password',
      }),
    ).toEqual({})
  })

  it('reports missing and invalid login fields', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    })

    expect(
      validateLoginForm({ email: 'not-an-email', password: 'password' }),
    ).toEqual({ email: 'Enter a valid email address.' })
  })
})

describe('validateRegisterForm', () => {
  const validValues = {
    confirmPassword: 'TrailSync1!',
    email: 'hiker@example.com',
    firstName: 'Trail',
    middleName: '',
    lastName: 'Hiker',
    suffix: '',
    age: '28',
    password: 'TrailSync1!',
    acceptedTerms: true,
  }

  it('requires a whole-number age of at least 18', () => {
    for (const age of ['', '0', '2.5', 'abc']) {
      expect(validateRegisterForm({ ...validValues, age })).toEqual({
        age: 'Enter your age as a whole number.',
      })
    }
    expect(validateRegisterForm({ ...validValues, age: '17' })).toEqual({
      age: 'You must be 18 or older to create an account.',
    })
    expect(validateRegisterForm({ ...validValues, age: '18' })).toEqual({})
  })

  it('accepts a valid registration form at the eight-character boundary', () => {
    expect(
      validateRegisterForm({
        ...validValues,
        confirmPassword: 'Abcdef1!',
        password: 'Abcdef1!',
      }),
    ).toEqual({})
  })

  it('rejects passwords shorter than eight characters', () => {
    expect(
      validateRegisterForm({
        ...validValues,
        confirmPassword: 'Abcde1!',
        password: 'Abcde1!',
      }),
    ).toEqual({ password: 'Password must be at least 8 characters' })
  })

  it('reports an empty confirmation and a mismatched confirmation separately', () => {
    expect(
      validateRegisterForm({ ...validValues, confirmPassword: '' }),
    ).toEqual({ confirmPassword: 'Confirm your password.' })

    expect(
      validateRegisterForm({
        ...validValues,
        confirmPassword: 'Different1!',
      }),
    ).toEqual({ confirmPassword: 'Passwords do not match.' })
  })

  it('accepts a middle name and suffix but does not require them', () => {
    expect(
      validateRegisterForm({
        ...validValues,
        middleName: 'Santos',
        suffix: 'Jr.',
      }),
    ).toEqual({})
  })

  it('limits the length of each name part', () => {
    expect(
      validateRegisterForm({
        ...validValues,
        firstName: 'J'.repeat(51),
        middleName: 'M'.repeat(51),
        lastName: 'C'.repeat(51),
        suffix: 'S'.repeat(11),
      }),
    ).toEqual({
      firstName: 'First name must be at most 50 characters.',
      middleName: 'Middle name must be at most 50 characters.',
      lastName: 'Last name must be at most 50 characters.',
      suffix: 'Suffix must be at most 10 characters.',
    })
  })

  it('requires agreeing to the Terms of Use and Privacy Policy', () => {
    expect(
      validateRegisterForm({ ...validValues, acceptedTerms: false }),
    ).toEqual({
      acceptedTerms:
        'Confirm you are 18 or older and agree to the Terms of Use and Privacy Policy.',
    })
  })

  it('reports required and invalid registration fields', () => {
    expect(
      validateRegisterForm({
        confirmPassword: '',
        email: 'invalid-email',
        firstName: '   ',
        middleName: '',
        lastName: '',
        suffix: '',
        age: '',
        password: '',
        acceptedTerms: false,
      }),
    ).toEqual({
      age: 'Enter your age as a whole number.',
      acceptedTerms:
        'Confirm you are 18 or older and agree to the Terms of Use and Privacy Policy.',
      confirmPassword: 'Confirm your password.',
      email: 'Enter a valid email address.',
      firstName: 'Enter your first name.',
      lastName: 'Enter your last name.',
      password: 'Password must be at least 8 characters',
    })
  })
})

describe('validateOtpCode', () => {
  it('accepts exactly 6 digits', () => {
    expect(validateOtpCode('012345')).toBeUndefined()
  })

  it('asks for a missing code', () => {
    expect(validateOtpCode('')).toBe('Enter the 6-digit code we emailed you.')
  })

  it.each(['12345', '1234567', '12a456'])('rejects %j', (code) => {
    expect(validateOtpCode(code)).toBe('The code is 6 digits.')
  })
})

describe('composeFullName', () => {
  it('joins the parts that are present, in order', () => {
    expect(
      composeFullName({
        firstName: ' Juan ',
        middleName: 'Santos',
        lastName: 'Dela  Cruz',
        suffix: 'Jr.',
      }),
    ).toBe('Juan Santos Dela Cruz Jr.')
    expect(
      composeFullName({
        firstName: 'Maria Clara',
        middleName: '',
        lastName: 'Reyes',
        suffix: ' ',
      }),
    ).toBe('Maria Clara Reyes')
  })
})
