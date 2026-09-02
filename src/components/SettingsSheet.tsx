import { useEffect, type ReactNode } from 'react'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function SettingsSheet({ open, onClose, children }: SettingsSheetProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-sheet-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </header>
        <div className="settings-sheet-body">{children}</div>
      </div>
    </div>
  )
}
