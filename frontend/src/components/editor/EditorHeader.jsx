import { useCallback, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { FileText, Palette, Eye, Undo2, Redo2, Link2, UserPlus, MoreVertical, Copy, Trash2 } from 'lucide-react'
import Tooltip from './Tooltip'
import HeaderIconButton from './HeaderIconButton'
import StatusBadge from './StatusBadge'
import SaveIndicator from './SaveIndicator'
import PresenceAvatars from './PresenceAvatars'
import PublishButton from './PublishButton'
import useDismiss from './useDismiss'
import UserMenu, { useAccountActions } from '../UserMenu'

const TITLE_PLACEHOLDER = 'Biểu mẫu không có tiêu đề'
const DESKTOP_ONLY = 'hidden md:inline-flex'

function HeaderTitle({ value, onChange, readOnly }) {
  if (readOnly) {
    return (
      <span data-hdr="title" className="min-w-0 truncate px-2 py-1 text-lg text-gray-800">
        {value || TITLE_PLACEHOLDER}
      </span>
    )
  }
  return (
    <div data-hdr="title" className="min-w-0 inline-grid grid-cols-[minmax(0,1fr)]">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-2 py-1 text-lg">
        {value || TITLE_PLACEHOLDER}
      </span>
      <input
        aria-label="Tiêu đề biểu mẫu"
        data-prop="title"
        value={value}
        placeholder={TITLE_PLACEHOLDER}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && e.currentTarget.blur()}
        className="col-start-1 row-start-1 w-full min-w-0 px-2 py-1 text-lg text-gray-800 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-primary-600 focus:outline-none truncate"
      />
    </div>
  )
}

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div className="relative" ref={ref}>
      <HeaderIconButton
        hdr="more"
        icon={MoreVertical}
        label="Tùy chọn khác"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div role="menu" data-more-menu className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[60]">
          {items.map((item) => (item.divider ? (
            <div key={item.key} className={`border-t border-gray-200 my-1 ${item.mobileOnly ? 'md:hidden' : ''}`} />
          ) : (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              data-menu={item.key}
              onClick={() => { close(); item.onSelect() }}
              className={`w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${item.mobileOnly ? 'flex md:hidden' : 'flex'} ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          )))}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { key: 'edit', path: 'edit', label: 'Câu hỏi' },
  { key: 'responses', path: 'responses', label: 'Câu trả lời' },
  { key: 'settings', path: 'settings', label: 'Cài đặt' },
]

export default function EditorHeader({ editor }) {
  const {
    id, form, canEdit, isOwner, title, setTitle, saveState, retrySave, undo, redo, undoLabel, redoLabel, changeStatus, statusBusy,
    copyLink, openTheme, openPreview, openShare, duplicate, remove, goHome, responseCount,
  } = editor
  const accountActions = useAccountActions()

  const menuItems = [
    canEdit && { key: 'theme', label: 'Tùy chỉnh giao diện', icon: Palette, onSelect: openTheme, mobileOnly: true },
    { key: 'preview', label: 'Xem trước', icon: Eye, onSelect: openPreview, mobileOnly: true },
    { key: 'copy-link', label: 'Sao chép đường liên kết', icon: Link2, onSelect: copyLink, mobileOnly: true },
    { key: 'share', label: 'Thêm cộng tác viên', icon: UserPlus, onSelect: openShare, mobileOnly: true },
    { key: 'd1', divider: true, mobileOnly: true },
    { key: 'duplicate', label: 'Nhân bản', icon: Copy, onSelect: duplicate },
    isOwner && { key: 'delete', label: 'Xóa', icon: Trash2, onSelect: remove, danger: true },
    { key: 'd2', divider: true, mobileOnly: true },
    ...accountActions.map((a) => ({ ...a, mobileOnly: true })),
  ].filter(Boolean)

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50" data-editor-header>
      <div className="h-16 px-1 sm:px-4 flex items-center gap-0.5 sm:gap-1">
        <Tooltip label="Biểu mẫu">
          <Link to="/forms" onClick={goHome} aria-label="Về danh sách biểu mẫu" data-hdr="logo" className="p-1.5 rounded-full hover:bg-gray-100 flex-shrink-0">
            <FileText className="w-7 h-7 md:w-8 md:h-8 text-primary-600" />
          </Link>
        </Tooltip>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <HeaderTitle value={title} onChange={setTitle} readOnly={!canEdit} />
          <StatusBadge status={form?.status} className="hidden md:inline-flex" />
          {canEdit ? (
            <SaveIndicator state={saveState} onRetry={retrySave} />
          ) : (
            <span data-hdr="readonly" className="px-2 py-0.5 rounded border border-gray-300 text-xs font-medium text-gray-600 whitespace-nowrap">
              Chỉ xem
            </span>
          )}
        </div>

        <PresenceAvatars users={editor.presence} />

        {canEdit && <HeaderIconButton hdr="theme" icon={Palette} label="Tùy chỉnh giao diện" wrapperClassName={DESKTOP_ONLY} onClick={openTheme} />}
        <HeaderIconButton hdr="preview" icon={Eye} label="Xem trước" wrapperClassName={DESKTOP_ONLY} onClick={openPreview} />
        {canEdit && (
          <>
            <HeaderIconButton hdr="undo" icon={Undo2} label="Hoàn tác" tooltip={undoLabel ? `Hoàn tác: ${undoLabel}` : 'Hoàn tác'} disabled={!undoLabel} onClick={undo} />
            <HeaderIconButton hdr="redo" icon={Redo2} label="Làm lại" tooltip={redoLabel ? `Làm lại: ${redoLabel}` : 'Làm lại'} disabled={!redoLabel} onClick={redo} />
          </>
        )}
        <HeaderIconButton hdr="copy-link" icon={Link2} label="Sao chép đường liên kết của người trả lời" tooltip="Sao chép liên kết người trả lời" wrapperClassName={DESKTOP_ONLY} onClick={copyLink} />
        <HeaderIconButton hdr="share" icon={UserPlus} label="Thêm cộng tác viên" wrapperClassName={DESKTOP_ONLY} onClick={openShare} />
        {canEdit && (
          <div className="ml-1">
            <PublishButton status={form?.status} busy={statusBusy} onChangeStatus={changeStatus} onCopyLink={copyLink} />
          </div>
        )}
        <MoreMenu items={menuItems} />
        <UserMenu className="hidden md:block ml-1" hdr="user" />
      </div>

      <nav aria-label="Các phần của biểu mẫu" className="h-12 flex items-stretch justify-center gap-2 sm:gap-6">
        {TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={`/forms/${id}/${tab.path}`}
            data-tab={tab.key}
            className={({ isActive }) => `flex items-center gap-1.5 px-2 sm:px-3 text-sm font-medium border-b-[3px] transition-colors ${
              isActive ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {tab.key === 'responses' && responseCount > 0 && (
              <span data-response-count className="px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[11px] leading-none">
                {responseCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
