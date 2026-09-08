export function scrollSongOption(container: HTMLDivElement | null, index: number) {
  const option = container?.querySelector<HTMLElement>(`[data-option-index="${index}"]`)
  if (!container || !option) return
  if (option.offsetTop < container.scrollTop) container.scrollTop = option.offsetTop
  else if (option.offsetTop + option.offsetHeight > container.scrollTop + container.clientHeight) {
    container.scrollTop = option.offsetTop + option.offsetHeight - container.clientHeight
  }
}
