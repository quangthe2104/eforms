export const STATUS = {
  draft: { label: 'Bản nháp', className: 'bg-gray-100 text-gray-600' },
  published: { label: 'Đang nhận câu trả lời', className: 'bg-green-100 text-green-700' },
  closed: { label: 'Không nhận câu trả lời', className: 'bg-orange-100 text-orange-700' },
}

export default function StatusBadge({ status, className = '' }) {
  const s = STATUS[status] || STATUS.draft
  return (
    <span
      data-hdr="status"
      data-status={status}
      className={`items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${s.className} ${className}`}
    >
      {s.label}
    </span>
  )
}
