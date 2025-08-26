import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent } from './dialog'
import { User, Lock, Mail, Eye, EyeOff, Loader2, LogOut, LogIn } from 'lucide-react'

interface AuthState {
  user: any | null
  session: any | null
  isLoading: boolean
}

interface AuthDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  authState: AuthState
  onSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  onSignUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  onSignOut: () => Promise<{ success: boolean; error?: string }>
  onResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  isOpen,
  onOpenChange,
  authState,
  onSignIn,
  onSignUp,
  onSignOut,
  onResetPassword
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setError('')
      setSuccess('')
      setMode('signin')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          return
        }
        
        const result = await onSignUp(email, password)
        if (result.success) {
          setSuccess('Account created successfully! Please check your email for verification.')
          setMode('signin')
        } else {
          setError(result.error || 'Failed to create account')
        }
      } else if (mode === 'signin') {
        const result = await onSignIn(email, password)
        if (result.success) {
          onOpenChange(false)
        } else {
          setError(result.error || 'Failed to sign in')
        }
      } else if (mode === 'reset') {
        const result = await onResetPassword(email)
        if (result.success) {
          setSuccess('Password reset email sent! Check your inbox.')
          setMode('signin')
        } else {
          setError(result.error || 'Failed to send reset email')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      const result = await onSignOut()
      if (result.success) {
        onOpenChange(false)
      } else {
        setError(result.error || 'Failed to sign out')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (authState.user) {
    // User is authenticated - show user info and sign out option
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-6 p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Signed In</h3>
                <p className="text-sm text-gray-600">{authState.user.email}</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Sign Out
              </button>

              <button
                onClick={() => onOpenChange(false)}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-6 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <LogIn className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {mode === 'signin' && 'Sign In to CueMe'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'reset' && 'Reset Password'}
              </h3>
              <p className="text-sm text-gray-600">
                {mode === 'signin' && 'Access your QnA collections'}
                {mode === 'signup' && 'Create an account to save QnA collections'}
                {mode === 'reset' && 'Enter your email to reset password'}
              </p>
            </div>
          </div>

          {(error || success) && (
            <div className={`p-3 border rounded-md ${
              error 
                ? 'bg-red-50 border-red-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <p className={`text-sm ${
                error ? 'text-red-600' : 'text-green-600'
              }`}>
                {error || success}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'reset' && 'Send Reset Email'}
            </button>
          </form>

          <div className="space-y-2 text-center text-sm">
            {mode === 'signin' && (
              <>
                <button
                  onClick={() => setMode('reset')}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Forgot your password?
                </button>
                <div>
                  <span className="text-gray-600">Don't have an account? </span>
                  <button
                    onClick={() => setMode('signup')}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Sign up
                  </button>
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div>
                <span className="text-gray-600">Already have an account? </span>
                <button
                  onClick={() => setMode('signin')}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Sign in
                </button>
              </div>
            )}

            {mode === 'reset' && (
              <button
                onClick={() => setMode('signin')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}