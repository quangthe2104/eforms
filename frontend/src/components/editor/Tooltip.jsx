import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MARGIN = 4
const GAP = 6

/** Dark Google-style tooltip shown on hover and keyboard focus; replaces the browser `title`. */
export default function Tooltip({ label, children, className = '' }) {
  const anchorRef = useRef(null)
  const tipRef = useRef(null)
  const [pos, setPos] = useState(null)

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect && label) setPos({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom })
  }
  const hide = () => setPos(null)

  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!tip || !pos) return
    const rect = tip.getBoundingClientRect()
    let x = pos.x - rect.width / 2
    x = Math.min(Math.max(MARGIN, x), window.innerWidth - rect.width - MARGIN)
    let y = pos.bottom + GAP
    if (y + rect.height > window.innerHeight - MARGIN) y = Math.max(MARGIN, pos.top - rect.height - GAP)
    tip.style.left = `${x}px`
    tip.style.top = `${y}px`
    tip.style.visibility = 'visible'
  }, [pos, label])

  return (
    <span
      ref={anchorRef}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={(e) => e.target.matches(':focus-visible') && show()}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >
      {children}
      {pos && createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className="eforms-tooltip fixed z-[1000] max-w-[min(20rem,calc(100vw-8px))] px-2 py-1 text-xs font-medium text-white bg-gray-700 rounded shadow pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ top: pos.bottom + GAP, left: pos.x, visibility: 'hidden' }}
        >
          {label}
        </div>,
        document.body
      )}
    </span>
  )
}
