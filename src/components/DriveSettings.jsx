import React, { useState } from 'react'
import {
  connectDrive,
  disconnectDrive,
  getStoredClientId,
  isDriveConnected,
} from '../utils/googleDrive.js'

export default function DriveSettings({ onClose, onStatusChange }) {
  const [clientId, setClientId] = useState(getStoredClientId() || '')
  const [connected, setConnected] = useState(isDriveConnected())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const handleConnect = async () => {
    setError('')
    setLoading(true)
    try {
      await connectDrive(clientId, 'consent')
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
            Projects can now be uploaded to a <strong>Hobby Hub</strong> folder
            in your Drive.
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
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? 'Connecting…' : 'Connect Google Drive'}
          </button>

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
                external (or internal) users. Add your Google account as a test
                user.
              </li>
              <li>
                Go to <strong>Credentials → Create Credentials → OAuth client
                ID</strong>.
              </li>
              <li>Choose <strong>Web application</strong>.</li>
              <li>
                Under <strong>Authorized JavaScript origins</strong>, add:
                <code>http://localhost:5173</code>
              </li>
              <li>Copy the Client ID and paste it above.</li>
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
