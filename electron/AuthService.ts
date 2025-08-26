import { createClient, SupabaseClient, User } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
}

export class AuthService {
  private supabase: SupabaseClient
  private authState: AuthState = {
    user: null,
    session: null,
    isLoading: true
  }
  private listeners: ((state: AuthState) => void)[] = []

  constructor() {
    // Environment variables in Electron main process
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
      // Use placeholder values for development
      console.warn('Using placeholder Supabase configuration. Authentication will not work until proper credentials are provided.')
    }
    
    this.supabase = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key'
    )
    this.initialize()
  }

  private async initialize() {
    try {
      // Get the current session
      const { data: { session }, error } = await this.supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session:', error)
      }

      this.updateAuthState({
        user: session?.user || null,
        session: session,
        isLoading: false
      })

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        this.updateAuthState({
          user: session?.user || null,
          session: session,
          isLoading: false
        })
      })
    } catch (error) {
      console.error('Error initializing auth:', error)
      this.updateAuthState({
        user: null,
        session: null,
        isLoading: false
      })
    }
  }

  private updateAuthState(newState: AuthState) {
    this.authState = { ...newState }
    this.listeners.forEach(listener => listener(this.authState))
  }

  public onAuthStateChange(callback: (state: AuthState) => void) {
    this.listeners.push(callback)
    // Call immediately with current state
    callback(this.authState)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  public getAuthState(): AuthState {
    return { ...this.authState }
  }

  public async signInWithEmail(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      return { success: true, user: data.user }
    } catch (error) {
      console.error('Sign in error:', error)
      return { success: false, error: error.message }
    }
  }

  public async signUpWithEmail(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error

      return { success: true, user: data.user }
    } catch (error) {
      console.error('Sign up error:', error)
      return { success: false, error: error.message }
    }
  }

  public async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()
      
      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return { success: false, error: error.message }
    }
  }

  public async resetPassword(email: string) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email)
      
      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Reset password error:', error)
      return { success: false, error: error.message }
    }
  }

  public getSupabaseClient(): SupabaseClient {
    return this.supabase
  }

  public isAuthenticated(): boolean {
    return !!this.authState.user && !!this.authState.session
  }

  public getCurrentUser(): User | null {
    return this.authState.user
  }

  public getAccessToken(): string | null {
    return this.authState.session?.access_token || null
  }
}