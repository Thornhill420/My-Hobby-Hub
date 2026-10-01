import { mergeStates, statesEqual } from './src/utils/sync.js'

let failures = 0
function check(name, condition, detail) {
  if (condition) {
    console.log(`PASS ${name}`)
  } else {
    failures++
    console.log(`FAIL ${name}`, detail ?? '')
  }
}

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
const p = (id, updatedAtDays, extra = {}) => ({
  id,
  title: `p-${id}`,
  createdAt: daysAgo(30),
  updatedAt: daysAgo(updatedAtDays),
  ...extra,
})

// 1. Union of both sides
{
  const local = { projects: [p('a', 5)], deleted: {} }
  const remote = { projects: [p('b', 3)], deleted: {} }
  const merged = mergeStates(local, remote)
  check('union keeps both', merged.projects.length === 2)
}

// 2. Newest edit wins (smaller daysAgo = newer)
{
  const local = { projects: [p('a', 1, { title: 'newer' })], deleted: {} }
  const remote = { projects: [p('a', 4, { title: 'older' })], deleted: {} }
  const merged = mergeStates(local, remote)
  check('newest wins', merged.projects[0].title === 'newer')
}

// 3. Deletion propagates
{
  const local = { projects: [], deleted: { a: daysAgo(1) } }
  const remote = { projects: [p('a', 5)], deleted: {} }
  const merged = mergeStates(local, remote)
  check('deletion hides project', merged.projects.length === 0, JSON.stringify(merged))
}

// 4. Edit after deletion resurrects
{
  const local = { projects: [], deleted: { a: daysAgo(5) } }
  const remote = { projects: [p('a', 1)], deleted: {} }
  const merged = mergeStates(local, remote)
  check('edit after deletion wins', merged.projects.length === 1)
}

// 5. Tombstones survive merging
{
  const local = { projects: [], deleted: { a: daysAgo(1) } }
  const remote = { projects: [], deleted: { b: daysAgo(2) } }
  const merged = mergeStates(local, remote)
  check('tombstones merge', Object.keys(merged.deleted).length === 2, JSON.stringify(merged.deleted))
}

// 6. Old tombstones are pruned (older than 90 days)
{
  const local = { projects: [], deleted: { a: daysAgo(200) } }
  const merged = mergeStates(local, { projects: [], deleted: {} })
  check('old tombstones pruned', Object.keys(merged.deleted).length === 0)
}

// 7. Merge is order-independent and idempotent
{
  const a = {
    projects: [p('a', 5), p('b', 3)],
    deleted: { z: daysAgo(2) },
  }
  const b = { projects: [p('b', 3)], deleted: {} }
  const ab = mergeStates(a, b)
  const ba = mergeStates(b, a)
  check('order independent', statesEqual(ab, ba), JSON.stringify([ab, ba]))
  check('idempotent', statesEqual(ab, mergeStates(ab, ab)))
}

// 8. Local list order: newest created first
{
  const older = { ...p('old', 5), createdAt: daysAgo(10) }
  const newer = { ...p('new', 5), createdAt: daysAgo(1) }
  const merged = mergeStates(
    { projects: [newer, older], deleted: {} },
    { projects: [older, newer], deleted: {} }
  )
  check('newest created first', merged.projects[0].id === 'new')
}

// 9. Malformed input tolerated
{
  const merged = mergeStates({ projects: null, deleted: 'nope' }, null)
  check('malformed input safe', merged.projects.length === 0 && Object.keys(merged.deleted).length === 0)
}

console.log(failures === 0 ? '\nAll tests passed' : `\n${failures} test(s) failed`)
process.exit(failures === 0 ? 0 : 1)
