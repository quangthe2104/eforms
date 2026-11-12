import { forwardRef } from 'react'
import Tooltip from './Tooltip'

/** Icon-only header button: `label` is the aria-label and, unless `tooltip` is given, the tooltip text. */
const HeaderIconButton = forwardRef(function HeaderIconButton(
  { icon: Icon, label, tooltip, hdr, className = '', wrapperClassName = '', ...rest },
  ref
) {
  return (
    <Tooltip label={tooltip ?? label} className={wrapperClassName}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        data-hdr={hdr}
        className={`p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent ${className}`}
        {...rest}
      >
        <Icon className="w-5 h-5" />
      </button>
    </Tooltip>
  )
})

export default HeaderIconButton
