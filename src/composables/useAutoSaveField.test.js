import test from 'node:test'
import assert from 'node:assert/strict'
import { useAutoSaveField } from './useAutoSaveField.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function toggleJob(state, next, save) {
  return {
    value: next,
    save,
    revert: () => { state.ui = !next },
    restoreAttempt: () => { state.ui = next },
  }
}

test('invalid value is not saved and keeps the typed value', async () => {
  const autoSave = useAutoSaveField()
  let calls = 0
  const ok = await autoSave.run('amount', {
    value: 0,
    validate: (v) => (v < 1 ? 'ต้องมากกว่า 0' : ''),
    save: async () => { calls += 1 },
  })
  assert.equal(ok, false)
  assert.equal(calls, 0)
  assert.equal(autoSave.fields.amount.status, 'invalid')
  assert.equal(autoSave.fields.amount.error, 'ต้องมากกว่า 0')
  autoSave.clearInvalid('amount')
  assert.equal(autoSave.fields.amount.status, 'idle')
})

test('a change made while saving is queued, not reverted', async () => {
  const autoSave = useAutoSaveField()
  const state = { ui: false }
  const first = deferred()
  const sent = []
  const save = async (value) => {
    sent.push(value)
    if (sent.length === 1) await first.promise
    return { value }
  }

  state.ui = true
  const running = autoSave.run('full', toggleJob(state, true, save))
  state.ui = false
  autoSave.run('full', toggleJob(state, false, save))

  assert.equal(autoSave.fields.full.status, 'saving')
  first.resolve()
  await running

  assert.deepEqual(sent, [true, false])
  assert.equal(state.ui, false)
  assert.equal(autoSave.fields.full.status, 'saved')
})

test('failure rolls back to the last value the server confirmed', async () => {
  const autoSave = useAutoSaveField()
  const state = { ui: false }
  const first = deferred()
  let call = 0
  const save = async () => {
    call += 1
    if (call === 1) {
      await first.promise
      return {}
    }
    throw new Error('network')
  }

  state.ui = true
  const running = autoSave.run('full', toggleJob(state, true, save))
  state.ui = false
  autoSave.run('full', toggleJob(state, false, save))
  first.resolve()
  await running

  assert.equal(state.ui, true, 'first save succeeded, so true is the confirmed value')
  assert.equal(autoSave.fields.full.status, 'error')
  assert.equal(autoSave.fields.full.error, 'network')
})

test('single failure reverts and retry re-sends the attempted value', async () => {
  const autoSave = useAutoSaveField()
  const state = { ui: false }
  let fail = true
  const sent = []
  const save = async (value) => {
    sent.push(value)
    if (fail) throw { response: { data: { error: 'บันทึกไม่สำเร็จจากเซิร์ฟเวอร์' } } }
    return {}
  }

  state.ui = true
  await autoSave.run('full', toggleJob(state, true, save))
  assert.equal(state.ui, false)
  assert.equal(autoSave.fields.full.status, 'error')
  assert.equal(autoSave.fields.full.error, 'บันทึกไม่สำเร็จจากเซิร์ฟเวอร์')

  fail = false
  await autoSave.retry('full')
  assert.deepEqual(sent, [true, true])
  assert.equal(state.ui, true)
  assert.equal(autoSave.fields.full.status, 'saved')
})
