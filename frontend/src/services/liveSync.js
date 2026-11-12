import { formAPI } from './api'
import { createPollingTransport } from './syncTransport'
import { useFormStore, docOf } from '../store/formStore'
import { applyOps } from '../utils/ops'

/**
 * Live sync logic (plan §4.7), independent of the transport: applies other users' batches in revision
 * order through autosave (snapshot + store, no history/dirty), reloads on `reset` / `form.reload`,
 * reports presence and role changes (`my_role`). Viewers run it too (read-only).
 */
export function createLiveSync({ formId, autosave, getActiveField, onPresence, onRole, onFatal, createTransport = createPollingTransport }) {
  let disposed = false
  const store = () => useFormStore.getState()

  /** Whole form again; unsent local changes are re-applied on top (history is dropped). */
  async function reload() {
    let data = null
    for (let attempt = 0; attempt < 3; attempt++) {
      await autosave.idle()
      const seq = autosave.saveSeq()
      data = (await formAPI.getOne(formId)).data
      await autosave.idle()
      // A save that ran during the GET may be missing from it: fetch again.
      if (autosave.saveSeq() === seq) break
    }
    if (disposed || !data) return
    const pending = autosave.pendingOps()
    store().loadForm(data)
    autosave.reset()
    if (pending.length) store().commitDoc(applyOps(docOf(store()), pending), { history: false, delay: 300 })
  }

  async function handle(data) {
    // Our own save in flight: its revision decides how earlier/later remote batches combine with it.
    await autosave.idle()
    if (disposed || !data) return
    const changes = data.changes || []
    if (data.reset || changes.some((c) => c.ops?.some((op) => op.type === 'form.reload'))) {
      await reload()
    } else {
      const known = store().revision
      for (const change of changes) {
        if (change.revision <= known) continue
        autosave.applyRemote(change.ops || [], { user: change.user, revision: change.revision })
      }
      store().setRevision(data.revision)
    }
    if (disposed) return
    onPresence?.(data.presence || [])
    const role = data.my_role
    if (role && store().currentForm && role !== store().currentForm.my_role) {
      store().patchForm({ my_role: role })
      onRole?.(role)
    }
  }

  const transport = createTransport({
    formId,
    getParams: () => ({ since: store().revision, active_field: getActiveField?.() }),
    onMessage: handle,
    onFatal,
  })

  return {
    start: () => transport.start(),
    poke: (ms) => transport.poke(ms),
    dispose() {
      disposed = true
      transport.stop()
    },
  }
}
