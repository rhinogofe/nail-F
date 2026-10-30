import { reactive } from 'vue'

const SAVED_VISIBLE_MS = 2000

function emptyField() {
  return {
    status: 'idle',
    error: '',
    retryJob: null,
    queue: null,
    inflight: false,
    rollback: null,
    savedTimer: 0,
  }
}

/**
 * Per-field auto-save state: idle → saving → saved (2s) | error | invalid.
 *
 * A job is `{ value, validate?, save, apply?, revert?, restoreAttempt? }`.
 * - `revert()` puts the UI back to the value the server last confirmed.
 * - `restoreAttempt()` puts the UI to this job's value (used by retry, and as the
 *   rollback target once this job has been confirmed by the server).
 *
 * Changes made while a save is in flight are queued (latest wins) and never reverted
 * by the earlier save's result.
 */
export function useAutoSaveField() {
  const fields = reactive({})

  function ensure(key) {
    if (!fields[key]) fields[key] = emptyField()
    return fields[key]
  }

  function clearSavedTimer(field) {
    if (field.savedTimer) {
      clearTimeout(field.savedTimer)
      field.savedTimer = 0
    }
  }

  function markSaved(field) {
    field.status = 'saved'
    field.error = ''
    clearSavedTimer(field)
    field.savedTimer = setTimeout(() => {
      if (field.status === 'saved') field.status = 'idle'
      field.savedTimer = 0
    }, SAVED_VISIBLE_MS)
  }

  async function execute(key, job) {
    const field = ensure(key)
    const invalid = job.validate?.(job.value)
    if (invalid) {
      clearSavedTimer(field)
      field.status = 'invalid'
      field.error = invalid
      field.retryJob = null
      const queued = field.queue
      field.queue = null
      if (queued) return execute(key, queued)
      return false
    }

    clearSavedTimer(field)
    field.inflight = true
    field.status = 'saving'
    field.error = ''
    job.onStart?.()

    let ok = false
    let errorText = ''
    try {
      const data = await job.save(job.value)
      // A newer value is waiting; applying this response would flicker the UI back.
      if (!field.queue) job.apply?.(data, job.value)
      if (job.restoreAttempt) field.rollback = job.restoreAttempt
      ok = true
    } catch (error) {
      errorText = error?.response?.data?.error || error?.message || 'บันทึกไม่สำเร็จ'
    } finally {
      field.inflight = false
      job.onFinally?.()
    }

    const queued = field.queue
    field.queue = null
    if (queued) return execute(key, queued)

    if (ok) {
      field.retryJob = null
      markSaved(field)
    } else {
      field.retryJob = job
      field.rollback?.()
      field.status = 'error'
      field.error = errorText
    }
    return ok
  }

  async function run(key, job) {
    const field = ensure(key)
    if (field.inflight) {
      field.queue = job
      return
    }
    field.rollback = job.revert || null
    return execute(key, job)
  }

  async function retry(key) {
    const field = ensure(key)
    const job = field.retryJob
    if (!job) return
    job.restoreAttempt?.()
    if (field.inflight) {
      field.queue = job
      return
    }
    return execute(key, job)
  }

  function clearInvalid(key) {
    const field = fields[key]
    if (field?.status === 'invalid') {
      field.status = 'idle'
      field.error = ''
    }
  }

  return { fields, ensure, run, retry, clearInvalid }
}
