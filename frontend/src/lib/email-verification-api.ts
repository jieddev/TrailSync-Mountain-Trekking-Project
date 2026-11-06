import { requestJson } from './api'

export { ApiError } from './api'

export type VerificationCodeSent = {
  email: string
  expiresAt: string
  resendAvailableAt: string
}

// Emails a 6-digit code to a hiker who is signing up. No login is needed yet.
export function requestVerificationCode(email: string) {
  return requestJson<VerificationCodeSent>(
    '/api/v1/email-verifications',
    { method: 'POST', body: { email } },
    'Could not send the verification code.',
  )
}

// Checks the code; once it passes, the account can be created.
export function verifyEmailCode(email: string, code: string) {
  return requestJson<{ email: string; verified: true }>(
    '/api/v1/email-verifications/verify',
    { method: 'POST', body: { email, code } },
    'Could not check the verification code.',
  )
}
