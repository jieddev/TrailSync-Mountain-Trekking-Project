import { describe, expect, it } from 'vitest'

import { homePathForRole } from './role-routes'

describe('homePathForRole', () => {
  it('sends coordinators to their dashboard', () => {
    expect(homePathForRole('COORDINATOR')).toBe('/coordinator')
  })

  it('sends hikers and any other role to the hiker home', () => {
    expect(homePathForRole('HIKER')).toBe('/home')
    expect(homePathForRole('GUIDE')).toBe('/home')
  })
})
