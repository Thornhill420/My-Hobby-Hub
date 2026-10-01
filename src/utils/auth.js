const PASSWORD_KEY = 'hobby-hub-password'

// Read password from Vite environment variable (set in .env or GitHub Actions)
// Falls back to 'hobby2026' if not set (for local development)
const DEFAULT_PASSWORD = 'hobby2026'
const STORED_PASSWORD = import.meta.env.VITE_APP_PASSWORD || DEFAULT_PASSWORD

export function checkPassword() {
  return localStorage.getItem(PASSWORD_KEY) === 'set'
}

export function authenticate(password) {
  if (password === STORED_PASSWORD) {
    localStorage.setItem(PASSWORD_KEY, 'set')
    return true
  }
  return false
}

export function logout() {
  localStorage.removeItem(PASSWORD_KEY)
}