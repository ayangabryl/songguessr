import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Headphones, Glasses, Shirt, Footprints, Flower2, Cat, Circle, Palette, RotateCcw, Sparkles } from 'lucide-react'
import { SettingsSheet } from './SettingsSheet'
import { Noot3D } from './Noot3D'
import { useNootPreferences } from '../lib/noot/preferences'
import { loadDisplayName, saveDisplayName } from '../lib/player'
import { parseSittingName } from '../../shared/sitting'
import { NOOT_TAILORED, type NootAppearance } from '../../shared/noot-profile'
import { NOOT_COLORS, nootColorHex, type NootColor } from '../../shared/noot-colors'
import '../wardrobe.css'

type Slot = 'headgear' | 'eyewear' | 'clothing' | 'footwear'
const categories = [
  { key: 'headgear', label: 'Head', icon: Headphones },
  { key: 'eyewear', label: 'Eyes', icon: Glasses },
  { key: 'clothing', label: 'Outfit', icon: Shirt },
  { key: 'footwear', label: 'Feet', icon: Footprints },
] as const
const items: Record<Slot, { id: string; label: string; detail: string; icon?: typeof Shirt }[]> = {
  headgear: [
    { id: 'headphones', label: 'Studio', detail: 'A little music, everywhere.', icon: Headphones },
    { id: 'cat-earphones', label: 'Kitten', detail: 'Soft peach. Tiny ears.', icon: Cat },
    { id: 'beanie', label: 'Knit beanie', detail: 'A cozy ribbed crown.' },
    { id: 'bucket', label: 'Bucket hat', detail: 'Made for sunny days.' },
    { id: 'daisy', label: 'Daisy', detail: 'A flower for your favorite song.', icon: Flower2 },
    { id: 'none', label: 'Just Noot', detail: 'That familiar little note.', icon: Circle },
  ],
  eyewear: [
    { id: 'none', label: 'Bare eyes', detail: 'Let those big eyes shine.', icon: Circle },
    { id: 'round', label: 'Round frames', detail: 'A thoughtful little look.', icon: Glasses },
    { id: 'sunny', label: 'Sunglasses', detail: 'Rounded frames. Smoked lenses.', icon: Glasses },
  ],
  clothing: [
    { id: 'none', label: 'Just Noot', detail: 'Comfortable in your own skin.', icon: Circle },
    { id: 'shirt', label: 'Everyday tee', detail: 'Your everyday favorite.' },
    { id: 'cardigan', label: 'Cozy cardigan', detail: 'Soft edging and little buttons.' },
    { id: 'varsity', label: 'Varsity jacket', detail: 'Contrast sleeves. Big team spirit.' },
    { id: 'overalls', label: 'Overalls', detail: 'A tiny pocket for big adventures.' },
    { id: 'dress', label: 'Sundress', detail: 'A swishy skirt with a ribbon at the waist.' },
    { id: 'ballet', label: 'Ballet dress', detail: 'Two soft ruffles, ready for a little twirl.' },
    { id: 'suit', label: 'Little suit', detail: 'A crisp shirt, tiny lapels, and a bow tie.' },
    { id: 'hoodie', label: 'Street hoodie', detail: 'A roomy hoodie and a little musical chain.' },
    { id: 'tracksuit', label: 'Track jacket', detail: 'Sporty stripes for your next dance break.' },
    { id: 'raincoat', label: 'Raincoat', detail: 'A cozy hood and pockets for rainy days.' },
    { id: 'scarf', label: 'Soft scarf', detail: 'A warm wrap with a gentle drape.' },
    { id: 'bow', label: 'Bow tie', detail: 'Dressed for the encore.' },
    { id: 'bandana', label: 'Bandana', detail: 'A little color around the collar.' },
  ],
  footwear: [
    { id: 'none', label: 'Bare feet', detail: 'Noot’s original little feet.', icon: Footprints },
    { id: 'sneakers', label: 'Sneakers', detail: 'Soft soles and tiny laces.', icon: Footprints },
    { id: 'boots', label: 'Ankle boots', detail: 'Ready for a little adventure.', icon: Footprints },
    { id: 'high-tops', label: 'High-tops', detail: 'Padded ankles and fresh little laces.', icon: Footprints },
    { id: 'mary-janes', label: 'Mary Janes', detail: 'Rounded toes and a tiny buckle.', icon: Footprints },
  ],
}
const patterns = [['plain', 'Plain'], ['stripes', 'Stripes'], ['dots', 'Dots'], ['gingham', 'Check'], ['confetti', 'Confetti']] as const
const looks: { label: string; color: string; outfit: Partial<NootAppearance> }[] = [
  { label: 'Cozy club', color: '#b87985', outfit: { headgear: 'beanie', headColor: 'ivory', clothing: 'cardigan', trimColor: 'ivory', accessoryColor: 'rose', footwear: 'boots', shoeColor: 'cocoa', eyewear: 'round', pattern: 'plain' } },
  { label: 'Team Noot', color: '#426b54', outfit: { headgear: 'headphones', headColor: 'ivory', clothing: 'varsity', trimColor: 'ivory', accessoryColor: 'forest', footwear: 'sneakers', shoeColor: 'ivory', eyewear: 'none', pattern: 'plain' } },
  { label: 'Day off', color: '#7893ab', outfit: { headgear: 'bucket', headColor: 'yellow', clothing: 'overalls', trimColor: 'ivory', accessoryColor: 'blue', footwear: 'sneakers', shoeColor: 'coral', eyewear: 'sunny', pattern: 'plain' } },
  { label: 'Garden party', color: '#e7abc0', outfit: { headgear: 'daisy', clothing: 'dress', accessoryColor: 'pink', trimColor: 'ivory', footwear: 'mary-janes', shoeColor: 'rose', eyewear: 'none', pattern: 'dots' } },
  { label: 'Little encore', color: '#4e647c', outfit: { headgear: 'headphones', clothing: 'suit', accessoryColor: 'navy', trimColor: 'black', footwear: 'mary-janes', shoeColor: 'black', eyewear: 'none', pattern: 'plain' } },
  { label: 'Street beat', color: '#303635', outfit: { headgear: 'beanie', headColor: 'red', clothing: 'hoodie', accessoryColor: 'black', trimColor: 'red', footwear: 'high-tops', shoeColor: 'red', eyewear: 'sunny', pattern: 'plain' } },
  { label: 'Ballet club', color: '#9c88b6', outfit: { headgear: 'daisy', clothing: 'ballet', accessoryColor: 'lavender', trimColor: 'pink', footwear: 'mary-janes', shoeColor: 'pink', eyewear: 'none', pattern: 'plain' } },
  { label: 'Track day', color: '#438c91', outfit: { headgear: 'headphones', clothing: 'tracksuit', accessoryColor: 'teal', trimColor: 'ivory', footwear: 'high-tops', shoeColor: 'teal', eyewear: 'none', pattern: 'plain' } },
  { label: 'Rainy day', color: '#e5c86d', outfit: { headgear: 'bucket', headColor: 'yellow', clothing: 'raincoat', accessoryColor: 'yellow', trimColor: 'orange', footwear: 'boots', shoeColor: 'orange', eyewear: 'none', pattern: 'plain' } },
]

function ItemIcon({ slot, id, Icon }: { slot: Slot; id: string; Icon?: typeof Shirt }) {
  if (id === 'dress' || id === 'ballet') return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 3 1 5h6l1-5M8 3l-2 2 3 6-5 10h16l-5-10 3-6-2-2M9 11h6" />{id === 'ballet' && <path d="m6 16 6 2 6-2" />}</svg>
  if (id === 'suit') return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 3-4 3v15h16V6l-4-3-4 7-4-7ZM8 3l-1 7 5 6 5-6-1-7M12 16v5" /><path d="m10 5 2 1 2-1v3l-2-1-2 1Z" /></svg>
  if (id === 'hoodie') return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 0 1 8 0l4 3 1 10h-4v2H7v-2H3l1-10 4-3ZM8 7l4 3 4-3M9 16h6l1 4H8l1-4M10 10v3m4-3v3" /></svg>
  if (Icon) return <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
  if (slot === 'headgear') return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{id === 'beanie' ? <><path d="M5 16v-3a7 7 0 0 1 14 0v3M8 15v-4m4 4V9m4 6v-4" /><rect x="4" y="16" width="16" height="5" rx="2" /></> : <><path d="m6 15 1-8c2-2 8-2 10 0l1 8M6 15l-3 4q9 4 18 0l-3-4M6 15q6 2 12 0" /></>}</svg>
  return <Shirt size={25} strokeWidth={1.6} aria-hidden="true" />
}

export function NootProfile({ onClose, welcome = false }: { onClose: () => void; welcome?: boolean }) {
  const [appearance, update, persisted] = useNootPreferences()
  const [name, setName] = useState(loadDisplayName), [error, setError] = useState('')
  const [pet, setPet] = useState(0), [view, setView] = useState(0), [slot, setSlot] = useState<Slot>('clothing'), [colorPart, setColorPart] = useState<'main' | 'accent'>('main')
  const nameInput = useRef<HTMLInputElement>(null), rail = useRef<HTMLDivElement>(null), strip = useRef<HTMLDivElement>(null), editor = useRef<HTMLElement>(null)
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  const options = items[slot], selectedIndex = Math.max(0, options.findIndex(o => o.id === (appearance[slot] ?? 'none'))), selected = options[selectedIndex]
  const hasAccent = slot === 'clothing' && NOOT_TAILORED.some(id => id === appearance.clothing)
  const editingAccent = hasAccent && colorPart === 'accent'
  const colorKey = editingAccent ? 'trimColor' : slot === 'headgear' ? 'headColor' : slot === 'footwear' ? 'shoeColor' : 'accessoryColor'
  const color = appearance[colorKey] ?? (editingAccent ? '#eee7d7' : appearance.accessoryColor)
  const canColor = slot === 'clothing' ? selected.id !== 'none' : slot === 'footwear' ? selected.id !== 'none' : slot === 'headgear' && ['beanie', 'bucket'].includes(selected.id)
  useEffect(() => { if (editor.current) editor.current.scrollTop = 0 }, [slot])
  useEffect(() => {
    const row = strip.current, item = row?.children[selectedIndex] as HTMLElement | undefined
    if (!row || !item) return
    const bounds = row.getBoundingClientRect(), selectedBounds = item.getBoundingClientRect()
    if (selectedBounds.left < bounds.left + 3) row.scrollLeft += selectedBounds.left - bounds.left - 3
    else if (selectedBounds.right > bounds.right - 3) row.scrollLeft += selectedBounds.right - bounds.right + 3
  }, [slot, selectedIndex])
  function choose(index: number, focus = false) {
    const i = (index + options.length) % options.length
    update({ [slot]: options[i].id } as Partial<NootAppearance>)
    if (focus) (strip.current?.children[i] as HTMLElement)?.focus({ preventScroll: true })
  }
  function itemKeys(e: KeyboardEvent, index: number) {
    const next = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : undefined
    if (next !== undefined) { e.preventDefault(); choose(next, true) }
  }
  function categoryKeys(e: KeyboardEvent, index: number) {
    const next = e.key === 'ArrowDown' ? (index + 1) % categories.length : e.key === 'ArrowUp' ? (index + categories.length - 1) % categories.length : e.key === 'Home' ? 0 : e.key === 'End' ? categories.length - 1 : undefined
    if (next !== undefined) { e.preventDefault(); setSlot(categories[next].key); (rail.current?.children[next] as HTMLElement)?.focus() }
  }
  function save() {
    const result = parseSittingName(name)
    if (!result.ok) { setError('Choose a name with 2–24 characters.'); nameInput.current?.focus(); return }
    saveDisplayName(result.name); window.dispatchEvent(new Event('songguessr-profile')); onClose()
  }
  function tint(value: NootColor) { if (value !== color) update({ [colorKey]: value }) }
  return <div className="app-shell profile-shell wardrobe-shell" data-theme={theme} data-difficulty="easy" data-welcome={welcome}>
    <SettingsSheet open onClose={onClose} title={welcome ? 'Meet your Noot' : 'Your wardrobe'} closeLabel="Close customization">
      <div className="wardrobe-stage">
        <div className="wardrobe-categories" ref={rail} role="tablist" aria-label="Customize from head to foot" aria-orientation="vertical">
          {categories.map(({ key, label, icon: Icon }, i) => <button key={key} type="button" role="tab" id={`wardrobe-tab-${key}`} aria-controls="wardrobe-items" aria-selected={slot === key} tabIndex={slot === key ? 0 : -1} onClick={() => { setSlot(key); if (editor.current) editor.current.scrollTop = 0 }} onKeyDown={e => categoryKeys(e, i)}><Icon size={25} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></button>)}
        </div>
        <div className="wardrobe-model">
          <button type="button" className="wardrobe-pet mascot" aria-label="See an outfit gesture" onClick={() => setPet(p => p + 1)}>
            <Noot3D {...appearance} viewYaw={view} pose={pet ? 'outfit' : 'idle'} eventId={pet} difficulty="easy" theme={theme} />
          </button>
          <div className="wardrobe-angles" role="group" aria-label="Preview angle">
            {[[0, 'Front'], [.72, 'Turn'], [Math.PI, 'Back']].map(([angle, label]) => <button type="button" key={label} aria-pressed={view === angle} onClick={() => setView(Number(angle))}>{label === 'Turn' && <RotateCcw size={13} aria-hidden="true" />}{label}</button>)}
          </div>
          <span className="wardrobe-hint">Tap Noot to show it off</span>
        </div>
      </div>
      <section className="wardrobe-editor" ref={editor} role="tabpanel" id="wardrobe-items" aria-labelledby={`wardrobe-tab-${slot}`}>
        <div className="wardrobe-selection"><div><span className="wardrobe-eyebrow">{categories.find(c => c.key === slot)!.label} · {selectedIndex + 1} / {options.length}</span><h3>{selected.label}</h3></div><div className="wardrobe-stepper"><button type="button" aria-label="Previous item" onClick={() => choose(selectedIndex - 1)}><ChevronLeft size={18} /></button><button type="button" aria-label="Next item" onClick={() => choose(selectedIndex + 1)}><ChevronRight size={18} /></button></div></div>
        <p className="wardrobe-description">{selected.detail}</p>
        <div className="wardrobe-item-strip" ref={strip} role="radiogroup" aria-label={`${categories.find(c => c.key === slot)!.label} items`}>
          {options.map((item, i) => <button key={item.id} type="button" role="radio" aria-checked={i === selectedIndex} tabIndex={i === selectedIndex ? 0 : -1} onClick={() => choose(i)} onKeyDown={e => itemKeys(e, i)}><ItemIcon slot={slot} id={item.id} Icon={item.icon} /><span>{item.label}</span>{i === selectedIndex && <Check size={12} className="wardrobe-equipped" aria-hidden="true" />}</button>)}
        </div>
        {hasAccent && <div className="wardrobe-color-parts" role="group" aria-label="Color section"><button type="button" aria-pressed={!editingAccent} onClick={() => setColorPart('main')}>Fabric</button><button type="button" aria-pressed={editingAccent} onClick={() => setColorPart('accent')}>Details</button></div>}
        {canColor && <fieldset className="wardrobe-colors"><legend>{editingAccent ? 'Detail color' : slot === 'headgear' ? 'Hat color' : slot === 'footwear' ? 'Shoe color' : 'Fabric color'}<span>{Object.hasOwn(NOOT_COLORS, color) ? NOOT_COLORS[color as keyof typeof NOOT_COLORS].label : editingAccent && !appearance.trimColor ? 'Warm cream' : 'Custom'}</span><label className="wardrobe-custom" title="Choose any color"><Palette size={20} aria-hidden="true" /><input type="color" aria-label="Custom color" value={nootColorHex(color)} onInput={e => tint(e.currentTarget.value as NootColor)} onChange={e => tint(e.target.value as NootColor)} /></label></legend><div className="wardrobe-palette">
          {Object.entries(NOOT_COLORS).map(([value, swatch]) => <button type="button" key={value} aria-label={swatch.label} title={swatch.label} aria-pressed={color === value} style={{ '--swatch': swatch.hex } as CSSProperties} onClick={() => tint(value as NootColor)}>{color === value && <Check size={15} aria-hidden="true" />}</button>)}

        </div></fieldset>}
        {slot === 'clothing' && canColor && !editingAccent && <div className="wardrobe-patterns" role="group" aria-label="Fabric pattern">{patterns.map(([value, label]) => <button type="button" key={value} aria-pressed={appearance.pattern === value} onClick={() => update({ pattern: value })}><i aria-hidden="true" data-pattern={value} />{label}</button>)}</div>}
        <div className="wardrobe-looks"><span><Sparkles size={14} aria-hidden="true" />Try a whole look</span><div>{looks.map(look => <button key={look.label} type="button" onClick={() => { update(look.outfit); setSlot('clothing'); setColorPart('main'); if (editor.current) editor.current.scrollTop = 0; setPet(p => p + 1) }}><i style={{ background: look.color }} aria-hidden="true" />{look.label}</button>)}</div></div>
      </section>
      <form className="wardrobe-footer" onSubmit={e => { e.preventDefault(); save() }}>
        <label className="wardrobe-name"><span>Your name</span><input ref={nameInput} value={name} onChange={e => { setName(e.target.value); setError('') }} maxLength={24} autoComplete="nickname" placeholder="Your name" aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-name-error' : undefined} /></label>
        <span className="wardrobe-save-note">{persisted && <Check size={14} aria-hidden="true" />} {persisted ? 'Outfit saved on this device' : 'Kept for this session'}</span>
        <button type="submit" className="wardrobe-done">{welcome ? 'Start listening' : 'Back to game'}<ArrowRight size={18} aria-hidden="true" /></button>
        {error && <p id="profile-name-error" role="alert">{error}</p>}
      </form>
    </SettingsSheet>
  </div>
}
