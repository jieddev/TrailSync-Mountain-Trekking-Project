import { describe, expect, it } from 'vitest'

import { ApiError } from '../../../lib/api'
import { dispatchErrorMessage, isStaleRefusal } from './dispatch'

describe('dispatch error handling', () => {
  it('maps refusal codes to coordinator wording and falls back otherwise', () => {
    expect(
      dispatchErrorMessage(
        new ApiError('x', 409, 'NO_GUIDE_AVAILABLE'),
        'fallback',
      ),
    ).toMatch(/No guide is available/)
    expect(
      dispatchErrorMessage(
        new ApiError('x', 500, 'INTERNAL_SERVER_ERROR'),
        'fallback',
      ),
    ).toBe('fallback')
    expect(dispatchErrorMessage(new Error('network'), 'fallback')).toBe(
      'fallback',
    )
  })

  it('reloads after stale-state conflicts but not when the queue is empty', () => {
    expect(isStaleRefusal(new ApiError('x', 409, 'BOOKING_NOT_WAITING'))).toBe(
      true,
    )
    expect(isStaleRefusal(new ApiError('x', 409, 'NO_GUIDE_AVAILABLE'))).toBe(
      false,
    )
    expect(isStaleRefusal(new ApiError('x', 500))).toBe(false)
  })
})
