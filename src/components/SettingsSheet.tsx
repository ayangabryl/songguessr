import { useRef, type ReactNode } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  closeLabel?: string
}

export function SettingsSheet({
  open,
  onClose,
  children,
  title = 'Settings',
  closeLabel = 'Close settings',
}: SettingsSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, panelRef, onClose)

  if (!open) return null

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-sheet-head">
          <h2 id="settings-title">{title}</h2>
          <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </header>
        <div className="settings-sheet-body">{children}</div>
      </div>
    </div>
  )
}
