export const DELETIONS_KEY = 'hobby-project-deletions'

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export function emptyState() {
  return { projects: [], deleted: {} }
}

export function loadDeletions() {
  try {
    const raw = localStorage.getItem(DELETIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.error('Failed to load deletions from localStorage', error)
    return {}
  }
}

export function saveDeletions(deleted) {
  try {
    localStorage.setItem(DELETIONS_KEY, JSON.stringify(deleted))
  } catch (error) {
    console.error('Failed to save deletions to localStorage', error)
  }
}

export function normalizeState(state) {
  return {
    projects: Array.isArray(state?.projects) ? state.projects : [],
    deleted:
      state?.deleted && typeof state.deleted === 'object' ? state.deleted : {},
  }
}

function pruneTombstones(deleted) {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  const pruned = {}
  for (const [id, timestamp] of Object.entries(deleted)) {
    const time = Date.parse(timestamp)
    if (!Number.isNaN(time) && time > cutoff) {
      pruned[id] = timestamp
    }
  }
  return pruned
}

// Merge two { projects, deleted } states.
// - Newest version of a project wins (by updatedAt)
// - A deletion tombstone hides a project unless it was edited after the deletion
export function mergeStates(localState, remoteState) {
  const local = normalizeState(localState)
  const remote = normalizeState(remoteState)

  const deleted = {}
  for (const [id, timestamp] of Object.entries(local.deleted)) {
    deleted[id] = timestamp
  }
  for (const [id, timestamp] of Object.entries(remote.deleted)) {
    if (!deleted[id] || timestamp > deleted[id]) {
      deleted[id] = timestamp
    }
  }
  const finalDeleted = pruneTombstones(deleted)

  const byId = new Map()
  for (const project of local.projects) {
    if (project?.id) byId.set(project.id, project)
  }
  for (const project of remote.projects) {
    if (!project?.id) continue
    const existing = byId.get(project.id)
    if (!existing || (project.updatedAt || '') > (existing.updatedAt || '')) {
      byId.set(project.id, project)
    }
  }

  const projects = [...byId.values()].filter((project) => {
    const deletedAt = finalDeleted[project.id]
    // Hide the project unless it was edited after it was deleted.
    return !deletedAt || deletedAt < (project.updatedAt || '')
  })

  projects.sort(
    (a, b) =>
      (b.createdAt || b.updatedAt || '').localeCompare(
        a.createdAt || a.updatedAt || ''
      ) || (b.updatedAt || '').localeCompare(a.updatedAt || '')
  )

  return { projects, deleted: finalDeleted }
}

export function statesEqual(a, b) {
  const left = normalizeState(a)
  const right = normalizeState(b)
  return (
    JSON.stringify(left.projects) === JSON.stringify(right.projects) &&
    JSON.stringify(left.deleted) === JSON.stringify(right.deleted)
  )
}
