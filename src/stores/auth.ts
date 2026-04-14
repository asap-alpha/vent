import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/plugins/firebase'
import type { UserProfile } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(() => profile.value?.displayName || user.value?.email || '')

  async function init(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser
        if (firebaseUser) {
          await fetchProfile(firebaseUser.uid)
        } else {
          profile.value = null
        }
        initialized.value = true
        resolve()
      })
    })
  }

  async function fetchProfile(uid: string) {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      profile.value = { uid, ...snap.data() } as UserProfile
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      user.value = cred.user
      await fetchProfile(cred.user.uid)
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(name: string, email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name })

      // Create user profile in Firestore
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

      user.value = cred.user
      profile.value = { uid: cred.user.uid, ...userProfile }
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
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
    displayName,
    init,
    login,
    register,
    logout,
    fetchProfile,
  }
})
