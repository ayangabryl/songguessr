export function bodyPortal(): HTMLElement | undefined {
  return typeof document === 'undefined' ? undefined : document.body
}
