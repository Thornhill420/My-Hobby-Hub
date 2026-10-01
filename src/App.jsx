import React, { useState, useEffect } from 'react'
import ProjectList from './components/ProjectList.jsx'
import ProjectForm from './components/ProjectForm.jsx'
import ProjectDetail from './components/ProjectDetail.jsx'
import DriveSettings from './components/DriveSettings.jsx'
import { v4 as uuidv4 } from 'uuid'
import { isDriveConnected, syncProjectToDrive } from './utils/googleDrive.js'

const STORAGE_KEY = 'hobby-projects'

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

export default function App() {
  const [projects, setProjects] = useState(loadProjects)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showDriveSettings, setShowDriveSettings] = useState(false)
  const [driveConnected, setDriveConnected] = useState(isDriveConnected())
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    saveProjects(projects)
  }, [projects])

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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>My Hobby Hub</h1>
          <div className="header-actions">
            <button
              className={`btn drive-toggle ${
                driveConnected ? 'drive-connected' : ''
              }`}
              onClick={() => setShowDriveSettings((prev) => !prev)}
            >
              {driveConnected ? '☁️ Drive Connected' : '☁️ Connect Drive'}
            </button>
            <button className="btn btn-primary" onClick={openAddForm}>
              + Add New Project
            </button>
          </div>
        </div>
        <p>A place for all your 3D printing, Arduino, ESP32, apps and more.</p>
      </header>

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
