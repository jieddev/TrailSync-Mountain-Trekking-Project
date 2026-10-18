export const coordinatorHomePath = '/coordinator/bookings'
export const hikerHomePath = '/home'

export function homePathForRole(role: string) {
  return role === 'COORDINATOR' ? coordinatorHomePath : hikerHomePath
}
