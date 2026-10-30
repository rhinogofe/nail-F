import { reactive } from 'vue'

const SAVED_VISIBLE_MS = 2000

function emptyField() {
  return {
    status: 'idle',
    error: '',
    retryJob: null,
    queue: null,
    inflight: false,
    savedTimer: 0,
  }
}

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
    field.retryJob = null
    clearSavedTimer(field)
    field.savedTimer = window.setTimeout(() => {
      if (field.status === 'saved') field.status = 'idle'
      field.savedTimer = 0
    }, SAVED_VISIBLE_MS)
  }

  async function execute(key, job) {
    const field = ensure(key)
    const invalid = job.validate?.(job.value)
    if (invalid) {
      field.status = 'invalid'
      field.error = invalid
      field.retryJob = null
      return false
    }

    field.inflight = true
    field.status = 'saving'
    field.error = ''
    field.retryJob = job
    job.onStart?.()

    try {
      const data = await job.save(job.value)
      job.apply?.(data, job.value)
      markSaved(field)
      return true
    } catch (error) {
      job.revert?.()
      field.status = 'error'
      field.error = error?.response?.data?.error || error?.message || 'บันทึกไม่สำเร็จ'
      return false
    } finally {
      field.inflight = false
      job.onFinally?.()
      const queued = field.queue
      field.queue = null
      if (queued) await execute(key, queued)
    }
  }

  async function run(key, job) {
    const field = ensure(key)
    if (field.inflight) {
      field.queue = job
      return
    }
    return execute(key, job)
  }

  async function retry(key) {
    const field = ensure(key)
    const job = field.retryJob
    if (!job) return
    job.restoreAttempt?.()
    return execute(key, job)
  }

  return { fields, ensure, run, retry }
}
