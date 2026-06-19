import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Auth.css'

function validatePassword(pw) {
  const errs = {}
  if (pw.length < 6) errs.length = 'At least 6 characters'
  if (!/[a-z]/.test(pw)) errs.lower = 'At least one lowercase letter'
  if (!/[A-Z]/.test(pw)) errs.upper = 'At least one uppercase letter'
  if (!/\d/.test(pw)) errs.digit = 'At least one number'
  return errs
}

export default function Auth({ onSuccess, initialMode } = {}) {
  const [mode, setMode] = useState(initialMode || 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [serverMessage, setServerMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const switchMode = (next) => {
    setMode(next)
    setErrors({})
    setServerError('')
    setServerMessage('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
  }

  const handleSignUp = async () => {
    const pwErrors = validatePassword(password)
    const fieldErrors = {}
    if (!displayName.trim()) fieldErrors.displayName = 'Required'
    if (!email) fieldErrors.email = 'Required'
    if (Object.keys(pwErrors).length) fieldErrors.password = pwErrors
    if (password !== confirmPassword) fieldErrors.confirmPassword = 'Passwords do not match'
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName.trim() } }
    })
    setLoading(false)
    if (error) { setServerError(error.message); return }
    onSuccess?.()
  }

  const handleSignIn = async () => {
    const fieldErrors = {}
    if (!email) fieldErrors.email = 'Required'
    if (!password) fieldErrors.password = 'Required'
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setLoading(true)
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('confirm')) {
        setServerError('Please confirm your email before signing in.')
      } else {
        setServerError('Invalid email or password.')
      }
    } else {
      onSuccess?.()
    }
  }

  const handleForgotPassword = async () => {
    const fieldErrors = {}
    if (!email) fieldErrors.email = 'Required'
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setLoading(true)
    setServerError('')
    setServerMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    setLoading(false)
    if (error) {
      setServerError(error.message)
    } else {
      setServerMessage('Check your email for a password reset link.')
    }
  }

  const handleResetPassword = async () => {
    const pwErrors = validatePassword(password)
    const fieldErrors = {}
    if (Object.keys(pwErrors).length) fieldErrors.password = pwErrors
    if (password !== confirmPassword) fieldErrors.confirmPassword = 'Passwords do not match'
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setLoading(true)
    setServerError('')
    setServerMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setServerError(error.message)
    } else {
      setServerMessage('Password updated successfully.')
      setTimeout(() => onSuccess?.(), 1500)
    }
  }

  // Reset-password mode: user just clicked the email link
  if (mode === 'resetpassword') {
    return (
      <div className="auth-card">
        <h3 className="auth-heading">Set a new password</h3>
        <form onSubmit={e => { e.preventDefault(); handleResetPassword() }}>
          <div className="auth-field">
            <input
              className="auth-input"
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {errors.password && (
              <ul className="auth-pw-errors">
                {Object.values(errors.password).map(e => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
          <div className="auth-field">
            <input
              className="auth-input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
          </div>
          {serverError && <p className="auth-server-error">{serverError}</p>}
          {serverMessage && <p className="auth-success-message">{serverMessage}</p>}
          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading ? '…' : 'Update Password'}
          </button>
        </form>
      </div>
    )
  }

  // Forgot-password mode: enter email to receive reset link
  if (mode === 'forgot') {
    return (
      <div className="auth-card">
        <h3 className="auth-heading">Reset your password</h3>
        <p className="auth-subtext">Enter your email and we'll send you a reset link.</p>
        <form onSubmit={e => { e.preventDefault(); handleForgotPassword() }}>
          <div className="auth-field">
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <span className="auth-error">{errors.email}</span>}
          </div>
          {serverError && <p className="auth-server-error">{serverError}</p>}
          {serverMessage && <p className="auth-success-message">{serverMessage}</p>}
          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading ? '…' : 'Send Reset Link'}
          </button>
        </form>
        <p className="auth-toggle">
          <button className="auth-link" onClick={() => switchMode('signin')}>Back to sign in</button>
        </p>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <button className="signin-btn google-btn" onClick={handleGoogleLogin}>
        Continue with Google
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={e => { e.preventDefault(); mode === 'signup' ? handleSignUp() : handleSignIn() }}>
          {mode === 'signup' && (
            <div className="auth-field">
              <input
                className="auth-input"
                placeholder="Display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
              />
              {errors.displayName && <span className="auth-error">{errors.displayName}</span>}
            </div>
          )}
          <div className="auth-field">
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <span className="auth-error">{errors.email}</span>}
          </div>
          <div className="auth-field">
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'signup' && errors.password && (
              <ul className="auth-pw-errors">
                {Object.values(errors.password).map(e => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
          {mode === 'signup' && (
            <div className="auth-field">
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
            </div>
          )}
          {serverError && <p className="auth-server-error">{serverError}</p>}
          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading ? '…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

      {mode === 'signin' && (
        <p className="auth-forgot">
          <button className="auth-link" onClick={() => switchMode('forgot')}>Forgot password?</button>
        </p>
      )}

      <p className="auth-toggle">
          {mode === 'signin' ? (
            <>Don&apos;t have an account?{' '}
              <button className="auth-link" onClick={() => switchMode('signup')}>Sign up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button className="auth-link" onClick={() => switchMode('signin')}>Sign in</button>
            </>
          )}
        </p>
    </div>
  )
}