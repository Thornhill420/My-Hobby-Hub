import assert from 'node:assert/strict'
import { createServer } from 'vite'

const values = new Map([
  ['gd_access_token', 'test-token'],
  ['gd_token_expiry', String(Date.now() + 60 * 60 * 1000)],
])
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
}

const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), method: options.method || 'GET' })
  if (String(url).includes('/files?q=')) {
    return {
      ok: true,
      json: async () => ({ files: [{ id: 'existing-projects-file' }] }),
    }
  }
  return { ok: true, json: async () => ({ id: 'existing-projects-file' }) }
}

const vite = await createServer({ configFile: false, server: { middlewareMode: true } })
try {
  const drive = await vite.ssrLoadModule('/src/utils/googleDrive.js')
  await drive.uploadTextFile('projects.json', '{"projects":[]}', 'folder-id')

  const update = requests.find(({ url }) =>
    url.includes('/upload/drive/v3/files/existing-projects-file?uploadType=media')
  )
  assert.ok(update, 'existing Drive file should be updated')
  assert.equal(update.method, 'PATCH', 'Drive v3 file updates must use PATCH')
  console.log('PASS existing Drive files are updated with PATCH')
} finally {
  await vite.close()
}
