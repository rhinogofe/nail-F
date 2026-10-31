/**
 * Runs async tasks one at a time, in the order they were queued.
 * A failed task does not block the ones behind it.
 */
export function createSerialQueue() {
  let tail = Promise.resolve()
  return function enqueue(task) {
    const run = tail.then(task, task)
    tail = run.catch(() => {})
    return run
  }
}
