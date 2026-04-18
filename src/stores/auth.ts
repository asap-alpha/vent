import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { auth, db } from '@/plugins/firebase'
import { logger } from '@/utils/logger'
import type { UserProfile } from '@/types/auth'

const log = logger('auth')

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => profile.value?.displayName || user.value?.email || '')
  const isSuperAdmin = computed(() => profile.value?.platformRole === 'super_admin')

  async function init(): Promise<void> {
    log.info('Initializing auth state listener')
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser
        if (firebaseUser) {
          log.info('Auth state: signed in', { uid: firebaseUser.uid, email: firebaseUser.email })
          await fetchProfile(firebaseUser.uid)
        } else {
          log.info('Auth state: signed out')
          unsubscribeProfile()
          profile.value = null
        }
        initialized.value = true
        resolve()
      })
    })
  }

  let profileUnsub: Unsubscribe | null = null

  function unsubscribeProfile() {
    if (profileUnsub) {
      profileUnsub()
      profileUnsub = null
    }
  }

  async function fetchProfile(uid: string): Promise<void> {
    log.debug('Subscribing to user profile', { uid })
    unsubscribeProfile()

    return new Promise((resolve) => {
      let firstLoad = true
      profileUnsub = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            profile.value = { uid, ...snap.data() } as UserProfile
            log.info('Profile snapshot', {
              orgs: profile.value.organizations.length,
              defaultOrgId: profile.value.defaultOrgId,
              platformRole: profile.value.platformRole,
            })
          } else {
            log.warn('Profile doc missing', { uid })
          }
          if (firstLoad) {
            firstLoad = false
            resolve()
          }
        },
        (err) => {
          log.error('Profile subscription error', { code: err.code, message: err.message })
          if (firstLoad) {
            firstLoad = false
            resolve()
          }
        }
      )
    })
  }

  async function login(email: string, password: string) {
    log.info('Login attempt', { email })
    loading.value = true
    error.value = null
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      user.value = cred.user
      log.info('Login succeeded', { uid: cred.user.uid })
      await fetchProfile(cred.user.uid)
    } catch (e: any) {
      log.error('Login failed', { code: e.code, message: e.message })
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(name: string, email: string, password: string) {
    log.info('Register attempt', { email, name })
    loading.value = true
    error.value = null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      log.info('Auth account created', { uid: cred.user.uid })
      await updateProfile(cred.user, { displayName: name })

      const userProfile: Omit<UserProfile, 'uid'> = {
        email,
        displayName: name,
        photoURL: null,
        organizations: [],
        defaultOrgId: null,
        createdAt: new Date(),
      }
      await setDoc(doc(db, 'users', cred.user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
      })
      log.info('User profile doc created in Firestore')

      user.value = cred.user
      profile.value = { uid: cred.user.uid, ...userProfile }

      // Auto-send welcome email (fire-and-forget)
      import('@/composables/useEmail').then(({ sendWelcomeByEmail }) => {
        sendWelcomeByEmail().catch((err) => {
          log.error('Failed to send welcome email', { message: err.message })
        })
      })
    } catch (e: any) {
      log.error('Register failed', { code: e.code, message: e.message })
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loginWithGoogle() {
    log.info('Google sign-in attempt')
    loading.value = true
    error.value = null
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      user.value = cred.user
      log.info('Google sign-in succeeded', { uid: cred.user.uid, email: cred.user.email })

      // Check if profile exists — if not, create one (first-time Google sign-in)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) {
        log.info('First-time Google user — creating profile')
        const userProfile: Omit<UserProfile, 'uid'> = {
          email: cred.user.email || '',
          displayName: cred.user.displayName || '',
          photoURL: cred.user.photoURL,
          organizations: [],
          defaultOrgId: null,
          createdAt: new Date(),
        }
        await setDoc(doc(db, 'users', cred.user.uid), {
          ...userProfile,
          createdAt: serverTimestamp(),
        })
        profile.value = { uid: cred.user.uid, ...userProfile }

        // First-time Google user — send welcome email
        import('@/composables/useEmail').then(({ sendWelcomeByEmail }) => {
          sendWelcomeByEmail().catch((err) => {
            log.error('Failed to send welcome email', { message: err.message })
          })
        })
      } else {
        await fetchProfile(cred.user.uid)
      }
    } catch (e: any) {
      // User closed the popup — not an error
      if (e.code === 'auth/popup-closed-by-user') {
        log.debug('Google popup closed by user')
        return
      }
      log.error('Google sign-in failed', { code: e.code, message: e.message })
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    log.info('Logout')
    unsubscribeProfile()
    await signOut(auth)
    user.value = null
    profile.value = null
  }

  return {
    user,
    profile,
    initialized,
    loading,
    error,
    isAuthenticated,
    isSuperAdmin,
    displayName,
    init,
    login,
    loginWithGoogle,
    register,
    logout,
    fetchProfile,
  }
})
