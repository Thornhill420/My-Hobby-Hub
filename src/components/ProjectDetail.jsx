import React from 'react'

function FileIcon({ name }) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return '📄'
    case 'ino':
      return '🔌'
    case 'zip':
      return '📦'
    case 'txt':
      return '📝'
    default:
      return '📎'
  }
}

export default function ProjectDetail({
  project,
  onBack,
  onEdit,
  onDelete,
  driveConnected,
  onSyncToDrive,
  isSyncing,
}) {
  const downloadFile = (file) => {
    const link = document.createElement('a')
    link.href = file.dataUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="project-detail">
      <div className="project-detail-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Projects
        </button>
        <div className="project-detail-actions">
          {driveConnected && (
            <button
              className="btn btn-secondary"
              onClick={onSyncToDrive}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing…' : 'Sync to Drive'}
            </button>
          )}
          <button className="btn btn-primary" onClick={onEdit}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="project-detail-content">
        <div className="project-detail-title">
          <h1>{project.title}</h1>
          <span className="badge">{project.category}</span>
          {project.tags?.length > 0 && (
            <div className="tags">
              {project.tags.map((tag, idx) => (
                <span key={idx} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="project-detail-description">{project.description}</p>

        {project.images?.length > 0 && (
          <section className="detail-section">
            <h2>Images</h2>
            <div className="detail-images">
              {project.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.dataUrl}
                  alt={`${project.title} image ${idx + 1}`}
                />
              ))}
            </div>
          </section>
        )}

        {project.files?.length > 0 && (
          <section className="detail-section">
            <h2>Files</h2>
            <ul className="detail-files">
              {project.files.map((file, idx) => (
                <li key={idx}>
                  <span className="file-icon">
                    <FileIcon name={file.name} />
                  </span>
                  <span className="file-name">{file.name}</span>
                  <button
                    className="btn btn-small"
                    onClick={() => downloadFile(file)}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {project.resources?.length > 0 && (
          <section className="detail-section">
            <h2>Resources & Links</h2>
            <ul className="detail-resources">
              {project.resources.map((res, idx) => (
                <li key={idx}>
                  {res.url ? (
                    <a href={res.url} target="_blank" rel="noopener noreferrer">
                      {res.title || res.url}
                    </a>
                  ) : (
                    <span>{res.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {project.driveFolderId && (
          <div className="drive-status">
            <span className="drive-status-icon">☁️</span>
            <span>
              Stored in Google Drive folder: <strong>{project.driveFolderName || 'Hobby Hub'}</strong>
            </span>
          </div>
        )}

        <div className="project-detail-meta">
          <small>
            Created: {new Date(project.createdAt).toLocaleString()}
          </small>
          <small>
            Updated: {new Date(project.updatedAt).toLocaleString()}
          </small>
        </div>
      </div>
    </div>
  )
}
