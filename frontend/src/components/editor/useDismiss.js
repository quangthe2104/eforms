import { useEffect } from 'react'

/** Calls `onDismiss(reason)` on a mousedown outside `ref` ('outside') or on Escape ('escape') while `open`. */
export default function useDismiss(ref, open, onDismiss) {
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onDismiss('outside')
    }
    const onKey = (e) => e.key === 'Escape' && onDismiss('escape')
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onDismiss])
}
