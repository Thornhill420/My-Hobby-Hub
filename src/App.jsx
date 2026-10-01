import React, { useState, useEffect, useRef, useCallback } from 'react'
import ProjectList from './components/ProjectList.jsx'
import ProjectForm from './components/ProjectForm.jsx'
import ProjectDetail from './components/ProjectDetail.jsx'
import DriveSettings from './components/DriveSettings.jsx'
import { v4 as uuidv4 } from 'uuid'
import {
  isDriveConnected,
  syncProjectToDrive,
  loadSharedState,
  saveSharedState,
  importProjectsFromDrive,
  isFolderImportDone,
  markFolderImportDone,
} from './utils/googleDrive.js'
import {
  mergeStates,
  statesEqual,
  loadDeletions,
  saveDeletions,
} from './utils/sync.js'
import AuthGate from './components/AuthGate.jsx'
import { checkPassword, logout } from './utils/auth.js'

const STORAGE_KEY = 'hobby-projects'
const PUSH_DEBOUNCE_MS = 1500
const PULL_INTERVAL_MS = 60000
const FOCUS_SYNC_COOLDOWN_MS = 30000

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error('Failed to load projects from localStorage', error)
    return []
  }
}

function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch (error) {
    console.error('Failed to save projects to localStorage', error)
    alert('Could not save project. The file may be too large for browser storage.')
  }
}

const SYNC_LABELS = {
  local: 'Local only',
  loading: 'Loading…',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(checkPassword())
  const [projects, setProjects] = useState(loadProjects)
  const [deletions, setDeletions] = useState(loadDeletions)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showDriveSettings, setShowDriveSettings] = useState(false)
  const [driveConnected, setDriveConnected] = useState(isDriveConnected())
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(() =>
    isDriveConnected() ? 'loading' : 'local'
  )
  const [syncError, setSyncError] = useState('')

  const projectsRef = useRef(projects)
  const deletionsRef = useRef(deletions)
  const driveReadyRef = useRef(false)
  const syncInFlightRef = useRef(false)
  const pushInFlightRef = useRef(false)
  const pushQueuedRef = useRef(false)
  const pushFailedRef = useRef(false)
  const lastSyncAtRef = useRef(0)

  useEffect(() => {
    projectsRef.current = projects
    saveProjects(projects)
  }, [projects])

  useEffect(() => {
    deletionsRef.current = deletions
    saveDeletions(deletions)
  }, [deletions])

  const pushToDrive = useCallback(async () => {
    if (!isDriveConnected()) return
    if (pushInFlightRef.current) {
      pushQueuedRef.current = true
      return
    }
    pushInFlightRef.current = true
    setSyncStatus('syncing')
    setSyncError('')
    try {
      await saveSharedState({
        projects: projectsRef.current,
        deleted: deletionsRef.current,
      })
      pushFailedRef.current = false
      setSyncStatus('synced')
    } catch (error) {
      console.error('Failed to push projects to Drive', error)
      pushFailedRef.current = true
      setSyncStatus('error')
      setSyncError(error.message)
    } finally {
      pushInFlightRef.current = false
      if (pushQueuedRef.current) {
        pushQueuedRef.current = false
        pushToDrive()
      }
    }
  }, [])

  // Pull the shared list from Drive, merge it with local data, then push the
  // merged result if Drive does not already have it.
  const syncWithDrive = useCallback(
    async ({ allowImport = false } = {}) => {
      if (!isDriveConnected()) return
      if (syncInFlightRef.current) return
      syncInFlightRef.current = true

      if (!driveReadyRef.current) {
        setSyncStatus('loading')
      }
      setSyncError('')

      try {
        const remote = await loadSharedState()

        let imported = []
        if (allowImport && !isFolderImportDone()) {
          try {
            imported = await importProjectsFromDrive()
            markFolderImportDone()
          } catch (error) {
            // Non-fatal: the shared list itself still syncs without it.
            console.warn('Folder import failed, will retry next load', error)
          }
        }

        const remoteState = {
          projects: [...(remote?.projects || []), ...imported],
          deleted: remote?.deleted || {},
        }
        const localState = {
          projects: projectsRef.current,
          deleted: deletionsRef.current,
        }
        const merged = mergeStates(localState, remoteState)

        if (!statesEqual(merged, localState)) {
          setProjects(merged.projects)
          setDeletions(merged.deleted)
        }

        driveReadyRef.current = true

        if (!statesEqual(merged, remoteState) || pushFailedRef.current) {
          await pushToDrive()
        } else {
          setSyncStatus('synced')
        }
      } catch (error) {
        console.error('Drive sync failed', error)
        setSyncStatus('error')
        setSyncError(error.message)
      } finally {
        syncInFlightRef.current = false
        lastSyncAtRef.current = Date.now()
      }
    },
    [pushToDrive]
  )

  // Initial sync when logged in, and again whenever Drive is (re)connected.
  useEffect(() => {
    if (!authenticated) return
    if (!isDriveConnected()) {
      driveReadyRef.current = false
      setSyncStatus('local')
      return
    }
    syncWithDrive({ allowImport: true })
  }, [authenticated, driveConnected, syncWithDrive])

  // Periodic pull so changes from other devices appear, plus a pull when the
  // tab regains focus.
  useEffect(() => {
    if (!authenticated || !driveConnected) return

    const pull = () => syncWithDrive()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastSyncAtRef.current < FOCUS_SYNC_COOLDOWN_MS) return
      pull()
    }

    const interval = setInterval(pull, PULL_INTERVAL_MS)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authenticated, driveConnected, syncWithDrive])

  // Debounced push whenever projects or deletions change locally.
  useEffect(() => {
    if (!authenticated || !driveReadyRef.current || !isDriveConnected()) return
    const timer = setTimeout(() => pushToDrive(), PUSH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [projects, deletions, authenticated, pushToDrive])

  const syncProject = async (project) => {
    setIsSyncing(true)
    try {
      const folder = await syncProjectToDrive(project)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? {
                ...p,
                driveFolderId: folder.id,
                driveFolderName: folder.name,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      )
    } catch (err) {
      alert(`Google Drive sync failed: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAddProject = async (projectData, options = {}) => {
    const newProject = {
      ...projectData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProjects((prev) => [newProject, ...prev])
    setIsFormOpen(false)
    setEditingProject(null)
    setSelectedProjectId(newProject.id)

    if (options.syncToDrive && isDriveConnected()) {
      await syncProject(newProject)
    }
  }

  const handleUpdateProject = async (projectData, options = {}) => {
    const updatedProject = {
      ...editingProject,
      ...projectData,
      updatedAt: new Date().toISOString(),
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    )
    setIsFormOpen(false)
    setEditingProject(null)

    if (options.syncToDrive && isDriveConnected()) {
      await syncProject(updatedProject)
    }
  }

  const handleSyncToDrive = (project) => {
    if (!isDriveConnected()) {
      setShowDriveSettings(true)
      return
    }
    syncProject(project)
  }

  const handleDeleteProject = (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      const now = new Date().toISOString()
      setDeletions((prev) => ({ ...prev, [id]: now }))
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (selectedProjectId === id) {
        setSelectedProjectId(null)
      }
    }
  }

  const openAddForm = () => {
    setEditingProject(null)
    setIsFormOpen(true)
  }

  const openEditForm = (project) => {
    setEditingProject(project)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingProject(null)
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null

  if (!authenticated) {
    return <AuthGate onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>My Hobby Hub</h1>
          <div className="header-actions">
            {driveConnected && (
              <span
                className={`sync-status sync-${syncStatus}`}
                title={syncError || 'Projects are shared across your devices via Google Drive'}
              >
                <span className="sync-status-dot" />
                {SYNC_LABELS[syncStatus] || syncStatus}
              </span>
            )}
            <button
              className={`btn drive-toggle ${
                driveConnected ? 'drive-connected' : ''
              }`}
              onClick={() => setShowDriveSettings((prev) => !prev)}
            >
              {driveConnected ? '☁️ Drive Connected' : '☁️ Connect Drive'}
            </button>
            <button className="btn btn-secondary btn-small" onClick={() => { logout(); setAuthenticated(false) }} style={{marginRight: '0.5rem'}}>
              Lock
            </button>
            <button className="btn btn-primary" onClick={openAddForm}>
              + Add New Project
            </button>
          </div>
        </div>
        <p>A place for all your 3D printing, Arduino, ESP32, apps and more.</p>
      </header>

      {driveConnected && syncStatus === 'error' && (
        <div className="sync-error-bar" role="alert">
          <span className="sync-error-text">
            ⚠️ Sync error: {syncError || 'unknown error'}
          </span>
          <span className="sync-error-actions">
            <button
              className="btn btn-small btn-secondary"
              onClick={() => syncWithDrive({ allowImport: true })}
            >
              Retry
            </button>
            <button
              className="btn btn-small btn-secondary"
              onClick={() => setShowDriveSettings(true)}
            >
              Drive settings
            </button>
          </span>
        </div>
      )}

      {showDriveSettings && (
        <div className="drive-settings-container">
          <DriveSettings
            onClose={() => setShowDriveSettings(false)}
            onStatusChange={(connected) => setDriveConnected(connected)}
          />
        </div>
      )}

      <main className="app-main">
        {isFormOpen ? (
          <ProjectForm
            initialData={editingProject}
            onSubmit={editingProject ? handleUpdateProject : handleAddProject}
            onCancel={closeForm}
            driveConnected={driveConnected}
          />
        ) : selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProjectId(null)}
            onEdit={() => openEditForm(selectedProject)}
            onDelete={() => handleDeleteProject(selectedProject.id)}
            driveConnected={driveConnected}
            onSyncToDrive={() => handleSyncToDrive(selectedProject)}
            isSyncing={isSyncing}
          />
        ) : (
          <ProjectList
            projects={projects}
            onSelect={setSelectedProjectId}
            onEdit={openEditForm}
            onDelete={handleDeleteProject}
          />
        )}
      </main>
    </div>
  )
}
