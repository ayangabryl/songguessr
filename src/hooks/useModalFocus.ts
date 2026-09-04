import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.tabIndex !== -1 && el.getClientRects().length > 0,
  )
}

export function trapTab(root: ParentNode, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const nodes = focusables(root)
  if (nodes.length === 0) {
    event.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (!(active instanceof Node) || !root.contains(active)) {
    event.preventDefault()
    first.focus()
    return
  }
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
    return
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

export function useModalFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const room = document.querySelector('.console-room')
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'

    const tryFocus = () => {
      const root = panelRef.current
      if (!root) return false
      const first =
        root.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]') ??
        root
      first.focus()
      return root.contains(document.activeElement)
    }
    const lockBackground = () => {
      if (room instanceof HTMLElement) room.inert = true
    }
    let frames = 0
    const tick = () => {
      if (tryFocus()) {
        lockBackground()
        return
      }
      if (frames++ > 20) {
        lockBackground()
        return
      }
      frame = window.requestAnimationFrame(tick)
    }
    let frame = window.requestAnimationFrame(tick)
    const later = window.setTimeout(tick, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      const root = panelRef.current
      if (root) trapTab(root, event)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(later)
      window.removeEventListener('keydown', onKeyDown)
      html.style.overflow = previousOverflow
      if (room instanceof HTMLElement) room.inert = false
      opener?.focus()
    }
  }, [open, panelRef])
}
