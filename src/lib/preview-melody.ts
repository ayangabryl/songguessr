/** Original, generated melody for the development preview; never shipped as game audio. */
export function previewMelody() {
  const rate = 22050, frames = rate * 20, buffer = new ArrayBuffer(44 + frames * 2), view = new DataView(buffer)
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, frames * 2, true)
  const notes = [261.63,329.63,392,523.25,440,349.23,329.63,392]
  for (let i = 0; i < frames; i++) {
    const time = i / rate, beat = time / .4, phase = beat % 1, frequency = notes[Math.floor(beat) % notes.length]
    const envelope = Math.min(1, phase * 80) * Math.exp(-phase * 3.5)
    const wave = Math.sin(time * frequency * Math.PI * 2) + .2 * Math.sin(time * frequency * Math.PI * 4)
    view.setInt16(44 + i * 2, Math.round(wave * envelope * 6500), true)
  }
  return URL.createObjectURL(new Blob([buffer], {type:'audio/wav'}))
}
