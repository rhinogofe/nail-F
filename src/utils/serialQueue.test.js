import test from 'node:test'
import assert from 'node:assert/strict'
import { createSerialQueue } from './serialQueue.js'

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('tasks never overlap and run in queue order', async () => {
  const enqueue = createSerialQueue()
  const log = []
  let running = 0
  let maxRunning = 0
  const task = (name, ms) => async () => {
    running += 1
    maxRunning = Math.max(maxRunning, running)
    log.push(`start ${name}`)
    await tick(ms)
    log.push(`end ${name}`)
    running -= 1
    return name
  }

  const results = await Promise.all([enqueue(task('slow', 30)), enqueue(task('fast', 1))])
  assert.deepEqual(results, ['slow', 'fast'])
  assert.equal(maxRunning, 1)
  assert.deepEqual(log, ['start slow', 'end slow', 'start fast', 'end fast'])
})

test('a failing task rejects its caller but does not block the next one', async () => {
  const enqueue = createSerialQueue()
  const failing = enqueue(async () => { throw new Error('boom') })
  const next = enqueue(async () => 'ok')
  await assert.rejects(failing, /boom/)
  assert.equal(await next, 'ok')
})
