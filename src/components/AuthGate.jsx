import React, { useState } from 'react'
import { authenticate } from '../utils/auth.js'

export default function AuthGate({ onAuthenticated }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (authenticate(password)) {
      onAuthenticated()
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1>My Hobby Hub</h1>
        <p>Enter the password to access your projects</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-primary">
            Unlock
          </button>
        </form>
        <p className="auth-hint">Password: <code>hobby2026</code></p>
      </div>
    </div>
  )
}
