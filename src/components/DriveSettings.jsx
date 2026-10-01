import React, { useState } from 'react'
import {
  connectDrive,
  disconnectDrive,
  getStoredClientId,
  isDriveConnected,
} from '../utils/googleDrive.js'

const DEFAULT_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function connectErrorHint(message) {
  const m = message.toLowerCase()
  if (m.includes('popup')) return '' // already a friendly message
  if (
    m.includes('origin') ||
    m.includes('invalid_client') ||
    m.includes('unauthorized')
  ) {
    return "This site's address isn't allowed for this Client ID. In Google Cloud Console go to APIs & Services → Credentials → your OAuth client and add this site's URL under Authorized JavaScript origins."
  }
  if (
    m.includes('denied') ||
    m.includes('blocked') ||
    m.includes('verification')
  ) {
    return 'Google blocked that account. If your OAuth consent screen is in Testing mode, add the account you picked under APIs & Services → OAuth consent screen → Test users, then try again.'
  }
  return ''
}

export default function DriveSettings({ onClose, onStatusChange }) {
  const [clientId, setClientId] = useState(
    getStoredClientId() || DEFAULT_CLIENT_ID || ''
  )
  const [connected, setConnected] = useState(isDriveConnected())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const handleConnect = async () => {
    setError('')
    setLoading(true)
    try {
      await connectDrive(clientId)
      setConnected(true)
      onStatusChange?.(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    disconnectDrive()
    setConnected(false)
    onStatusChange?.(false)
  }

  return (
    <div className="drive-settings">
      <div className="drive-settings-header">
        <h2>Google Drive</h2>
        <button className="btn btn-small btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {connected ? (
        <div className="drive-connected">
          <p>
            <span className="drive-status-dot connected" /> Connected to Google
            Drive
          </p>
          <p className="drive-hint">
            Your project list lives in <strong>Hobby Hub/projects.json</strong>{' '}
            in your Drive and syncs automatically: changes made on any device
            show up on the others.
          </p>
          <p className="drive-hint">
            To share with another device, connect there with the{' '}
            <strong>same Client ID</strong> and the same Google account.
          </p>
          <button className="btn btn-danger" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="drive-connect-form">
          <p>
            Paste your Google Cloud <strong>OAuth Client ID</strong> to connect
            your Google Drive.
          </p>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxxx.apps.googleusercontent.com"
          />
          {error && <div className="form-error">{error}</div>}
          {error && connectErrorHint(error) && (
            <div className="drive-hint">{connectErrorHint(error)}</div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? 'Connecting…' : 'Connect Google Drive'}
          </button>
          <p className="drive-hint">
            Google will ask which account to use — pick the account you want
            your projects stored in.
          </p>

          <button
            type="button"
            className="link-button"
            onClick={() => setShowHelp((prev) => !prev)}
          >
            {showHelp ? 'Hide setup instructions' : 'How do I get a Client ID?'}
          </button>

          {showHelp && (
            <ol className="drive-help">
              <li>
                Go to the{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>
                .
              </li>
              <li>Create a new project (or select an existing one).</li>
              <li>
                Search for and enable the <strong>Drive API</strong>.
              </li>
              <li>
                Open <strong>OAuth consent screen</strong> and configure it for
                external (or internal) users. Under{' '}
                <strong>Test users</strong>, add{' '}
                <strong>every Google account</strong> you will sign in with on
                any device — accounts that are not on that list get an
                "Access blocked" screen.
              </li>
              <li>
                Go to <strong>Credentials → Create Credentials → OAuth client
                ID</strong>.
              </li>
              <li>Choose <strong>Web application</strong>.</li>
              <li>
                Under <strong>Authorized JavaScript origins</strong>, add:
                <code>http://localhost:5173</code> and{' '}
                <code>https://thornhill420.github.io</code>. Use the{' '}
                <strong>same Client ID on every device</strong> you want to
                share projects with.
              </li>
              <li>Copy the Client ID and paste it above.</li>
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
