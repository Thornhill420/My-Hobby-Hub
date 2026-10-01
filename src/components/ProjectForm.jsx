import React, { useState } from 'react'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ProjectForm({ initialData, onSubmit, onCancel, driveConnected }) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [category, setCategory] = useState(initialData?.category || 'General')
  const [description, setDescription] = useState(initialData?.description || '')
  const [tags, setTags] = useState((initialData?.tags || []).join(', '))
  const [images, setImages] = useState(initialData?.images || [])
  const [files, setFiles] = useState(initialData?.files || [])
  const [resources, setResources] = useState(initialData?.resources || [])
  const [syncToDrive, setSyncToDrive] = useState(driveConnected ?? false)
  const [error, setError] = useState('')

  const handleImageUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files)
    const newImages = await Promise.all(
      selectedFiles.map(async (file) => ({
        name: file.name,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file),
      }))
    )
    setImages((prev) => [...prev, ...newImages])
    e.target.value = ''
  }

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files)
    const newFiles = await Promise.all(
      selectedFiles.map(async (file) => ({
        name: file.name,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file),
      }))
    )
    setFiles((prev) => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const addResource = () => {
    setResources((prev) => [...prev, { title: '', url: '' }])
  }

  const updateResource = (index, field, value) => {
    setResources((prev) =>
      prev.map((res, i) => (i === index ? { ...res, [field]: value } : res))
    )
  }

  const removeResource = (index) => {
    setResources((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    const tagArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const cleanResources = resources.filter((r) => r.title.trim() || r.url.trim())

    onSubmit(
      {
        title: title.trim(),
        category: category.trim() || 'General',
        description: description.trim(),
        tags: tagArray,
        images,
        files,
        resources: cleanResources,
      },
      { syncToDrive }
    )
  }

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <h2>{initialData ? 'Edit Project' : 'Add New Project'}</h2>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 3D Printed Robot Arm"
        />
      </div>

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="3D Printing">3D Printing</option>
          <option value="Arduino">Arduino</option>
          <option value="ESP32">ESP32</option>
          <option value="Electronics">Electronics</option>
          <option value="App">App</option>
          <option value="Program">Program</option>
          <option value="General">General</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your project, what it does, how you built it, lessons learned..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="tags">Tags (comma separated)</label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. robot, 3d-print, esp32, sensor"
        />
      </div>

      <div className="form-group">
        <label htmlFor="images">Images</label>
        <input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
        />
        {images.length > 0 && (
          <div className="image-preview-grid">
            {images.map((img, idx) => (
              <div key={idx} className="image-preview-item">
                <img src={img.dataUrl} alt={img.name} />
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => removeImage(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="files">Files (PDF, .ino, .zip, etc.)</label>
        <input
          id="files"
          type="file"
          multiple
          onChange={handleFileUpload}
        />
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((file, idx) => (
              <li key={idx}>
                <span>{file.name}</span>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => removeFile(idx)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="form-group">
        <label>Resources & Links</label>
        <div className="resources-list">
          {resources.map((res, idx) => (
            <div key={idx} className="resource-item">
              <input
                type="text"
                value={res.title}
                onChange={(e) => updateResource(idx, 'title', e.target.value)}
                placeholder="Resource title"
              />
              <input
                type="url"
                value={res.url}
                onChange={(e) => updateResource(idx, 'url', e.target.value)}
                placeholder="https://..."
              />
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => removeResource(idx)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addResource}
        >
          + Add Resource
        </button>
      </div>

      {driveConnected && (
        <div className="form-group drive-sync-option">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={syncToDrive}
              onChange={(e) => setSyncToDrive(e.target.checked)}
            />
            Also upload this project to Google Drive
          </label>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {initialData ? 'Save Changes' : 'Add Project'}
        </button>
      </div>
    </form>
  )
}
