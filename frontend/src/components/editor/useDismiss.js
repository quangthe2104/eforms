import { useEffect } from 'react'

/** Calls `onDismiss` on a mousedown outside `ref` or on Escape while `open`. */
export default function useDismiss(ref, open, onDismiss) {
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onDismiss()
    }
    const onKey = (e) => e.key === 'Escape' && onDismiss()
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onDismiss])
}
