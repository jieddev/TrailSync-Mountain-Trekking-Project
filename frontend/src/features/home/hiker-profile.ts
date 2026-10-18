import { useOutletContext } from 'react-router-dom'

import type { CurrentUserProfile } from '../../lib/users-api'

export type HikerOutletContext = { profile: CurrentUserProfile }

// Pages rendered inside HikerLayout only mount once the profile has loaded.
export function useHikerProfile() {
  return useOutletContext<HikerOutletContext>().profile
}
