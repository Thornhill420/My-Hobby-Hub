const CLIENT_ID_KEY = 'gd_client_id'
const ACCESS_TOKEN_KEY = 'gd_access_token'
const REFRESH_TOKEN_KEY = 'gd_refresh_token'
const TOKEN_EXPIRY_KEY = 'gd_token_expiry'
const ROOT_FOLDER_ID_KEY = 'gd_root_folder_id'
const IMPORT_FLAG_KEY = 'gd_folder_import_done'
const LOGIN_HINT_KEY = 'gd_login_hint'
const EMAIL_KEY = 'gd_email'

const ROOT_FOLDER_NAME = 'Hobby Hub'
const SHARED_FILE_NAME = 'projects.json'

// openid + email let us show which Google account is connected
const DRIVE_SCOPE =
  'openid email https://www.googleapis.com/auth/drive.file'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export function getStoredClientId() {
  return localStorage.getItem(CLIENT_ID_KEY)
}

export function getStoredEmail() {
  return localStorage.getItem(EMAIL_KEY) || ''
}

export function hasStoredRefreshToken() {
  return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY))
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

function emailFromIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(padded)).email || ''
  } catch {
    return ''
  }
}

function storeTokenResponse(response) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token)
  localStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + (response.expires_in || 3600) * 1000)
  )
  if (response.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
  }
  if (response.id_token) {
    const email = emailFromIdToken(response.id_token)
    if (email) localStorage.setItem(EMAIL_KEY, email)
  }
}

function requestAccessToken(clientId, params) {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        resolve(response)
      },
      error_callback: (error) => {
        const messages = {
          popup_closed: 'The Google sign-in window was closed before finishing.',
          popup_failed_to_open:
            'The browser blocked the Google sign-in window. Allow popups for this site and try again.',
          unknown: 'Google sign-in failed.',
        }
        reject(new Error(messages[error.type] || messages.unknown))
      },
    })
    tokenClient.requestAccessToken(params)
  })
}

export function getStoredLoginHint() {
  return localStorage.getItem(LOGIN_HINT_KEY) || ''
}

export async function connectDrive(clientId, { loginHint = '' } = {}) {
  if (!clientId.trim()) {
    throw new Error('Please enter your Google Cloud Client ID')
  }

  await loadGoogleScripts()
  const id = clientId.trim()
  localStorage.setItem(CLIENT_ID_KEY, id)

  const hint = loginHint.trim()
  if (hint) {
    localStorage.setItem(LOGIN_HINT_KEY, hint)
  }

  // Show the account chooser (people often have several Google accounts
  // signed in) AND the consent screen in one popup — Google only issues the
  // refresh token we need when consent is shown. login_hint preselects the
  // account the user typed.
  const first = await requestAccessToken(id, {
    prompt: 'select_account consent',
    ...(hint ? { login_hint: hint } : {}),
  })
  storeTokenResponse(first)
  if (first.refresh_token) return first

  // Very old/odd responses can omit the refresh token; retry once.
  try {
    const second = await requestAccessToken(id, {
      prompt: 'consent',
      ...(hint ? { login_hint: hint } : {}),
    })
    storeTokenResponse(second)
    return second
  } catch (error) {
    console.warn('Connected without a refresh token', error)
    return first
  }
}

export function disconnectDrive() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(ROOT_FOLDER_ID_KEY)
  localStorage.removeItem(EMAIL_KEY)
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
    throw new Error(
      'Your Google session has expired and cannot renew itself. Open ☁️ Drive settings, click Disconnect, then Connect again.'
    )
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
    let detail = ''
    try {
      const data = await res.json()
      detail = `${data.error || ''} ${data.error_description || ''}`
    } catch {
      // ignore parse errors
    }
    if (detail.includes('invalid_grant')) {
      // Google expires refresh tokens for apps in "Testing" status after
      // 7 days, and revocations land here too.
      throw new Error(
        'Your Google sign-in has expired. Open ☁️ Drive settings, click Disconnect, then Connect again.'
      )
    }
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

export async function listFilesInFolder(folderId, mimeType = null) {
  const conditions = [`'${folderId}' in parents`, 'trashed=false']
  if (mimeType) {
    conditions.push(`mimeType='${mimeType}'`)
  }
  const query = conditions.join(' and ')

  const data = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&spaces=drive&pageSize=1000`
  )

  return data.files || []
}

async function findRootFolderByName() {
  const query = `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`
  const data = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
  )
  return data.files?.[0] || null
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
      if (!data.trashed && data.mimeType === FOLDER_MIME) {
        return storedId
      }
    } catch {
      // fall through and look for the shared root folder
    }
    localStorage.removeItem(ROOT_FOLDER_ID_KEY)
  }

  // Every device must share the same root folder, so look for an existing
  // "Hobby Hub" folder before creating a new one.
  const existing = await findRootFolderByName()
  if (existing) {
    localStorage.setItem(ROOT_FOLDER_ID_KEY, existing.id)
    return existing.id
  }

  const folder = await createFolder(ROOT_FOLDER_NAME)
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

async function downloadRequest(fileId) {
  const token = await getValidAccessToken()
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    let message = `Failed to download file (${res.status})`
    try {
      const data = await res.json()
      message = data.error?.message || message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return res
}

export async function downloadFileText(fileId) {
  const res = await downloadRequest(fileId)
  return res.text()
}

export async function downloadFileDataUrl(fileId, mimeType) {
  const res = await downloadRequest(fileId)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read downloaded file'))
    reader.readAsDataURL(
      blob.type ? blob : new Blob([blob], { type: mimeType })
    )
  })
}

export function isFolderImportDone() {
  return localStorage.getItem(IMPORT_FLAG_KEY) === 'true'
}

export function markFolderImportDone() {
  localStorage.setItem(IMPORT_FLAG_KEY, 'true')
}

// The shared project list every device reads from and writes to.
export async function loadSharedState() {
  const rootId = await ensureRootFolder()
  const file = await findFileByName(SHARED_FILE_NAME, rootId, 'application/json')
  if (!file) return null

  try {
    const parsed = JSON.parse(await downloadFileText(file.id))
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      deleted: parsed.deleted && typeof parsed.deleted === 'object' ? parsed.deleted : {},
    }
  } catch (error) {
    console.warn('Could not read shared projects file, treating as empty', error)
    return null
  }
}

export async function saveSharedState(state) {
  const rootId = await ensureRootFolder()
  const content = JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      projects: state.projects || [],
      deleted: state.deleted || {},
    },
    null,
    2
  )
  return uploadTextFile(SHARED_FILE_NAME, content, rootId, 'application/json')
}

async function downloadFolderContents(folderId) {
  const files = await listFilesInFolder(folderId)
  const contents = []
  for (const file of files) {
    try {
      contents.push({
        name: file.name,
        type: file.mimeType,
        dataUrl: await downloadFileDataUrl(file.id, file.mimeType),
      })
    } catch (error) {
      console.warn(`Skipping "${file.name}" during Drive import`, error)
    }
  }
  return contents
}

// One-time migration: rebuild projects from per-project folders that were
// uploaded with the old "Sync to Drive" button (device-local data only).
export async function importProjectsFromDrive() {
  const rootId = await ensureRootFolder()
  const folders = await listFilesInFolder(rootId, FOLDER_MIME)
  const projects = []

  for (const folder of folders) {
    try {
      const infoFile = await findFileByName(
        'project-info.json',
        folder.id,
        'application/json'
      )
      if (!infoFile) continue

      const info = JSON.parse(await downloadFileText(infoFile.id))
      if (!info?.id) continue

      const imagesFolder = await findFileByName('Images', folder.id, FOLDER_MIME)
      const filesFolder = await findFileByName('Files', folder.id, FOLDER_MIME)

      projects.push({
        ...info,
        images: imagesFolder ? await downloadFolderContents(imagesFolder.id) : [],
        files: filesFolder ? await downloadFolderContents(filesFolder.id) : [],
        driveFolderId: folder.id,
        driveFolderName: folder.name,
      })
    } catch (error) {
      console.warn(`Skipping Drive folder "${folder.name}" during import`, error)
    }
  }

  return projects
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