const PASSWORD_KEY = 'hobby-hub-password'

export function checkPassword() {
  return localStorage.getItem(PASSWORD_KEY) === 'set'
}

export function authenticate(password) {
  if (password === 'hobby2026') {
    localStorage.setItem(PASSWORD_KEY, 'set')
    return true
  }
  return false
}

export function logout() {
  localStorage.removeItem(PASSWORD_KEY)
}