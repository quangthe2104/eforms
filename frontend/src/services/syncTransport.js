import { formAPI, clientId } from './api'

const INTERVAL_MS = 2500
const HIDDEN_INTERVAL_MS = 15000
const MAX_BACKOFF_MS = 30000

/**
 * Live sync transport (plan §4.7): polls `GET /forms/{id}/changes`. Only moves messages; what to do with
 * them lives in liveSync.js, so this can be replaced by a WebSocket (Laravel Reverb) transport with the
 * same interface: `start()`, `stop()`, `poke(delay)`.
 *
 * - `getParams()` → `{ since, active_field }`, read at send time.
 * - `onMessage(data)` may return a promise; the next poll waits for it (no overlapping requests).
 * - `onFatal(status)`: 401/403/404 – polling stops.
 */
export function createPollingTransport({ formId, getParams, onMessage, onFatal }) {
  let timer = null
  let running = false
  let busy = false
  let backoff = 0
  let pokeAgain = false

  const delay = () => (backoff || (document.visibilityState === 'hidden' ? HIDDEN_INTERVAL_MS : INTERVAL_MS))

  function schedule(ms = delay()) {
    clearTimeout(timer)
    if (running) timer = setTimeout(tick, ms)
  }

  async function tick() {
    if (!running) return
    if (busy) {
      pokeAgain = true
      return
    }
    busy = true
    clearTimeout(timer)
    try {
      const { since, active_field } = getParams()
      const { data } = await formAPI.changes(formId, { since, client_id: clientId, active_field: active_field || undefined })
      backoff = 0
      if (running) await onMessage(data)
    } catch (error) {
      const status = error?.response?.status
      if ([401, 403, 404].includes(status)) {
        running = false
        onFatal?.(status)
        return
      }
      backoff = Math.min(backoff ? backoff * 2 : 5000, MAX_BACKOFF_MS)
    } finally {
      busy = false
    }
    if (pokeAgain) {
      pokeAgain = false
      schedule(200)
    } else {
      schedule()
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') schedule(0)
  }

  return {
    start() {
      if (running) return
      running = true
      document.addEventListener('visibilitychange', onVisibility)
      schedule(0)
    },
    stop() {
      running = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    },
    /** Poll soon (selection changed, a reload is needed…). */
    poke(ms = 300) {
      if (!running || backoff) return
      if (busy) pokeAgain = true
      else schedule(ms)
    },
  }
}
