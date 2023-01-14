import type { Auth, AuthUser } from './auth-types'

import { FirebaseAuth } from './firebase-auth'
import { authSession } from './auth-session'

/**
 * Initialized auth object
 */
const auth: Auth<AuthUser> = new FirebaseAuth(authSession)

export { auth }
