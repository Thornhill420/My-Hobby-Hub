import React from 'react'

export default function ProjectList({ projects, onSelect, onEdit, onDelete }) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <h2>No projects yet</h2>
        <p>Add your first project to get started!</p>
      </div>
    )
  }

  return (
    <div className="project-grid">
      {projects.map((project) => (
        <div
          key={project.id}
          className="project-card"
          onClick={() => onSelect(project.id)}
        >
          <div className="project-card-header">
            <h3>{project.title}</h3>
            <span className="badge">{project.category}</span>
          </div>

          <p className="project-card-description">
            {project.description?.slice(0, 120) || 'No description'}
            {project.description?.length > 120 ? '...' : ''}
          </p>

          {project.images?.length > 0 && (
            <div className="project-card-images">
              {project.images.slice(0, 3).map((img, idx) => (
                <img
                  key={idx}
                  src={img.dataUrl}
                  alt={`${project.title} image ${idx + 1}`}
                />
              ))}
              {project.images.length > 3 && (
                <span className="more-images">+{project.images.length - 3}</span>
              )}
            </div>
          )}

          <div className="project-card-footer">
            <small>{new Date(project.updatedAt).toLocaleDateString()}</small>
            <div className="project-card-actions">
              <button
                className="btn btn-small"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(project)
                }}
              >
                Edit
              </button>
              <button
                className="btn btn-small btn-danger"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(project.id)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
