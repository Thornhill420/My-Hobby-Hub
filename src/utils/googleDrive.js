const CLIENT_ID_KEY = 'gd_client_id'
const ACCESS_TOKEN_KEY = 'gd_access_token'
const REFRESH_TOKEN_KEY = 'gd_refresh_token'
const TOKEN_EXPIRY_KEY = 'gd_token_expiry'
const ROOT_FOLDER_ID_KEY = 'gd_root_folder_id'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export function getStoredClientId() {
  return localStorage.getItem(CLIENT_ID_KEY)
}

export function isDriveConnected() {
  return Boolean(
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
      localStorage.getItem(REFRESH_TOKEN_KEY)
  )
}

export async function loadGoogleScripts() {
  if (window.google?.accounts?.oauth2) return
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Google scripts'))
    document.head.appendChild(script)
  })
}

export async function connectDrive(clientId, prompt = 'consent') {
  if (!clientId.trim()) {
    throw new Error('Please enter your Google Cloud Client ID')
  }

  await loadGoogleScripts()
  localStorage.setItem(CLIENT_ID_KEY, clientId.trim())

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token)
        localStorage.setItem(
          TOKEN_EXPIRY_KEY,
          String(Date.now() + response.expires_in * 1000)
        )
        if (response.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
        }
        resolve(response)
      },
    })
    tokenClient.requestAccessToken({ prompt })
  })
}

export function disconnectDrive() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(ROOT_FOLDER_ID_KEY)
}

export async function getValidAccessToken() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0)

  if (accessToken && Date.now() < expiry - 60000) {
    return accessToken
  }

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  const clientId = localStorage.getItem(CLIENT_ID_KEY)

  if (!refreshToken || !clientId) {
    throw new Error('Not connected to Google Drive')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error('Failed to refresh Google Drive access token')
  }

  const data = await res.json()
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token)
  localStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + data.expires_in * 1000)
  )
  return data.access_token
}

async function driveFetch(url, options = {}) {
  const token = await getValidAccessToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    let message = `Google Drive error ${res.status}`
    try {
      const data = await res.json()
      message = data.error?.message || message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return res.json()
}

function escapeQuery(value) {
  return String(value).replace(/'/g, "''")
}

export async function createFolder(name, parentFolderId = null) {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentFolderId) {
    metadata.parents = [parentFolderId]
  }

  return driveFetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
}

export async function findFileByName(name, folderId, mimeType = null) {
  const conditions = [
    `'${folderId}' in parents`,
    `name='${escapeQuery(name)}'`,
    'trashed=false',
  ]
  if (mimeType) {
    conditions.push(`mimeType='${mimeType}'`)
  }
  const query = conditions.join(' and ')

  const data = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&spaces=drive`
  )

  if (data.files?.length > 0) {
    return data.files[0]
  }
  return null
}

export async function findOrCreateFolder(name, parentFolderId) {
  const existing = await findFileByName(
    name,
    parentFolderId,
    'application/vnd.google-apps.folder'
  )
  if (existing) {
    return existing
  }
  return createFolder(name, parentFolderId)
}

export async function ensureRootFolder() {
  const storedId = localStorage.getItem(ROOT_FOLDER_ID_KEY)

  if (storedId) {
    try {
      const data = await driveFetch(
        `${DRIVE_API}/files/${storedId}?fields=id,name,mimeType,trashed`
      )
      if (
        !data.trashed &&
        data.mimeType === 'application/vnd.google-apps.folder'
      ) {
        return storedId
      }
    } catch {
      // fall through and create a new root folder
    }
  }

  const folder = await createFolder('Hobby Hub')
  localStorage.setItem(ROOT_FOLDER_ID_KEY, folder.id)
  return folder.id
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

async function uploadFileResumable(metadata, blob) {
  const token = await getValidAccessToken()
  const total = blob.size
  const chunkSize = 5 * 1024 * 1024
  let position = 0

  // Start resumable session
  const startRes = await fetch(`${UPLOAD_API}/files?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  if (!startRes.ok) {
    let message = `Failed to start upload (${startRes.status})`
    try {
      const data = await startRes.json()
      message = data.error?.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const uploadUrl = startRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('No upload URL returned from Google Drive')
  }

  if (total === 0) {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': '*/0',
      },
    })
    if (!res.ok && res.status !== 200 && res.status !== 201) {
      throw new Error('Failed to upload empty file')
    }
    return res.json().catch(() => ({}))
  }

  while (position < total) {
    const end = Math.min(position + chunkSize, total)
    const chunk = blob.slice(position, end)

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${position}-${end - 1}/${total}`,
      },
      body: chunk,
    })

    if (res.status === 308 || res.status === 309) {
      position = end
      continue
    }

    if (!res.ok) {
      let message = `Upload failed (${res.status})`
      try {
        const data = await res.json()
        message = data.error?.message || message
      } catch {
        // ignore
      }
      throw new Error(message)
    }

    return res.json()
  }

  return {}
}

async function uploadFile(metadata, blob) {
  // Use resumable upload for all files - more reliable CORS support
  // Multipart upload has inconsistent browser CORS support
  console.log('Uploading:', metadata.name, 'size:', blob.size, 'type:', metadata.mimeType)
  return uploadFileResumable(metadata, blob)
}

async function updateFileContent(fileId, blob, mimeType) {
  const token = await getValidAccessToken()
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType || 'application/octet-stream',
    },
    body: blob,
  })

  if (!res.ok) {
    let message = `Failed to update file (${res.status})`
    try {
      const data = await res.json()
      message = data.error?.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  return res.json()
}

export async function uploadOrUpdateFile(file, folderId) {
  const existing = await findFileByName(file.name, folderId)
  const blob = dataUrlToBlob(file.dataUrl)
  const mimeType = file.type || blob.type || 'application/octet-stream'

  if (existing) {
    return updateFileContent(existing.id, blob, mimeType)
  }

  const metadata = {
    name: file.name,
    parents: [folderId],
  }
  if (mimeType) {
    metadata.mimeType = mimeType
  }

  return uploadFile(metadata, blob)
}

export async function uploadTextFile(
  name,
  content,
  folderId,
  mimeType = 'application/json'
) {
  const blob = new Blob([content], { type: mimeType })
  const existing = await findFileByName(name, folderId)

  if (existing) {
    return updateFileContent(existing.id, blob, mimeType)
  }

  const metadata = {
    name,
    parents: [folderId],
    mimeType,
  }

  return uploadFile(metadata, blob)
}

function generateReadme(project) {
  const lines = [
    `# ${project.title}`,
    '',
    `**Category:** ${project.category}`,
  ]

  if (project.tags?.length) {
    lines.push(`**Tags:** ${project.tags.join(', ')}`)
  }

  lines.push('', '## Description', '', project.description || 'No description.')

  if (project.resources?.length) {
    lines.push('', '## Resources & Links', '')
    project.resources.forEach((res) => {
      if (res.url) {
        lines.push(`- [${res.title || res.url}](${res.url})`)
      } else {
        lines.push(`- ${res.title}`)
      }
    })
  }

  lines.push(
    '',
    '---',
    `Created: ${new Date(project.createdAt).toLocaleString()}`,
    `Updated: ${new Date(project.updatedAt).toLocaleString()}`
  )

  return lines.join('\n')
}

export async function syncProjectToDrive(project) {
  const rootId = await ensureRootFolder()
  const folderName = `${project.category} - ${project.title}`
  const projectFolder = await findOrCreateFolder(folderName, rootId)

  const imagesFolder = await findOrCreateFolder('Images', projectFolder.id)
  const filesFolder = await findOrCreateFolder('Files', projectFolder.id)

  for (const image of project.images || []) {
    await uploadOrUpdateFile(image, imagesFolder.id)
  }

  for (const file of project.files || []) {
    await uploadOrUpdateFile(file, filesFolder.id)
  }

  const info = {
    id: project.id,
    title: project.title,
    category: project.category,
    description: project.description,
    tags: project.tags,
    resources: project.resources,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }

  await uploadTextFile(
    'project-info.json',
    JSON.stringify(info, null, 2),
    projectFolder.id,
    'application/json'
  )

  await uploadTextFile(
    'README.md',
    generateReadme(project),
    projectFolder.id,
    'text/markdown'
  )

  return projectFolder
}