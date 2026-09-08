import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Headphones, Glasses, Shirt, Footprints, Flower2, Cat, Circle, Palette, RotateCcw, Sparkles } from 'lucide-react'
import { SettingsSheet } from './SettingsSheet'
import { Noot3D } from './Noot3D'
import { useNootPreferences } from '../lib/noot/preferences'
import { loadDisplayName, saveDisplayName } from '../lib/player'
import { parseSittingName } from '../../shared/sitting'
import { NOOT_TAILORED, NOOT_FASHION_HATS, NOOT_FASHION_EYES, NOOT_FOOTWEAR, type NootAppearance } from '../../shared/noot-profile'
import { NOOT_COLORS, nootColorHex, type NootColor } from '../../shared/noot-colors'
import '../wardrobe.css'

type Slot = 'headgear' | 'eyewear' | 'clothing' | 'footwear'
const categories = [
  { key: 'headgear', label: 'Head', icon: Headphones },
  { key: 'eyewear', label: 'Eyes', icon: Glasses },
  { key: 'clothing', label: 'Outfit', icon: Shirt },
  { key: 'footwear', label: 'Feet', icon: Footprints },
  { key: 'looks', label: 'Looks', icon: Sparkles },
] as const
const items: Record<Slot, { id: string; label: string; detail: string; icon?: typeof Shirt }[]> = {
  headgear: [
    { id: 'headphones', label: 'Studio', detail: 'A little music, everywhere.', icon: Headphones },
    { id: 'cat-earphones', label: 'Kitten', detail: 'Soft peach. Tiny ears.', icon: Cat },
    { id: 'beanie', label: 'Knit beanie', detail: 'A cozy ribbed crown.' },
    { id: 'bucket', label: 'Bucket hat', detail: 'Made for sunny days.' },
    { id: 'daisy', label: 'Daisy', detail: 'A flower for your favorite song.', icon: Flower2 },
    { id: 'cap', label: 'Baseball cap', detail: 'A curved bill and soft crown.' },
    { id: 'beret', label: 'Soft beret', detail: 'Tilted wool with a fitted band.' },
    { id: 'visor', label: 'Sun visor', detail: 'An open crown and curved shade.' },
    { id: 'crown', label: 'Little crown', detail: 'Rounded points and tiny jewels.' },
    { id: 'party-hat', label: 'Party hat', detail: 'A tiny cone with a soft pom.' },
    { id: 'flower-crown', label: 'Flower crown', detail: 'A wreath of little blossoms.' },
    { id: 'none', label: 'Just Noot', detail: 'That familiar little note.', icon: Circle },
  ],
  eyewear: [
    { id: 'none', label: 'Bare eyes', detail: 'Let those big eyes shine.', icon: Circle },
    { id: 'round', label: 'Round frames', detail: 'A thoughtful little look.', icon: Glasses },
    { id: 'sunny', label: 'Sunglasses', detail: 'Rounded frames. Smoked lenses.', icon: Glasses },
    { id: 'square', label: 'Square frames', detail: 'Soft corners with clear lenses.', icon: Glasses },
    { id: 'cat-eye', label: 'Cat-eye frames', detail: 'Swept corners with clear lenses.', icon: Glasses },
    { id: 'aviator', label: 'Aviators', detail: 'Teardrop smoked lenses.', icon: Glasses },
    { id: 'heart', label: 'Heart shades', detail: 'Rounded hearts with smoked lenses.', icon: Glasses },
    { id: 'star', label: 'Star shades', detail: 'Soft star frames for the encore.', icon: Glasses },
    { id: 'sport', label: 'Sport shades', detail: 'A low wraparound sports frame.', icon: Glasses },
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
    { id: 'loafers', label: 'Penny loafers', detail: 'Square toes and a penny strap.', icon: Footprints },
    { id: 'sandals', label: 'Summer sandals', detail: 'Open toes with soft straps.', icon: Footprints },
    { id: 'slippers', label: 'Cozy slippers', detail: 'Fleece-lined with a little pom.', icon: Footprints },
    { id: 'ballet-flats', label: 'Ballet flats', detail: 'A low opening and tiny ribbons.', icon: Footprints },
  ],
}
const patterns = [['plain', 'Plain'], ['stripes', 'Stripes'], ['dots', 'Dots'], ['gingham', 'Check'], ['confetti', 'Confetti']] as const
const looks: { label: string; color: string; outfit: Partial<NootAppearance> }[] = [
  { label: 'Cozy club', color: '#b87985', outfit: { headgear: 'beanie', headColor: 'ivory', clothing: 'cardigan', trimColor: 'ivory', accessoryColor: 'rose', footwear: 'boots', shoeColor: 'cocoa', eyewear: 'round', pattern: 'plain' } },
  { label: 'Team Noot', color: '#426b54', outfit: { headgear: 'headphones', headColor: 'ivory', clothing: 'varsity', trimColor: 'ivory', accessoryColor: 'forest', footwear: 'sneakers', shoeColor: 'ivory', eyewear: 'none', pattern: 'plain' } },
  { label: 'Day off', color: '#7893ab', outfit: { headgear: 'bucket', headColor: 'yellow', clothing: 'overalls', trimColor: 'ivory', accessoryColor: 'blue', footwear: 'sneakers', shoeColor: 'coral', eyewear: 'sunny', pattern: 'plain' } },
  { label: 'Garden party', color: '#e7abc0', outfit: { headgear: 'flower-crown', clothing: 'dress', accessoryColor: 'pink', trimColor: 'ivory', footwear: 'mary-janes', shoeColor: 'rose', eyewear: 'none', pattern: 'dots' } },
  { label: 'Little encore', color: '#4e647c', outfit: { headgear: 'beret', headColor: 'navy', clothing: 'suit', accessoryColor: 'navy', trimColor: 'black', footwear: 'loafers', shoeColor: 'black', eyewear: 'none', pattern: 'plain' } },
  { label: 'Street beat', color: '#303635', outfit: { headgear: 'beanie', headColor: 'red', clothing: 'hoodie', accessoryColor: 'black', trimColor: 'red', footwear: 'high-tops', shoeColor: 'red', eyewear: 'sunny', pattern: 'plain' } },
  { label: 'Ballet club', color: '#9c88b6', outfit: { headgear: 'flower-crown', clothing: 'ballet', accessoryColor: 'lavender', trimColor: 'pink', footwear: 'ballet-flats', shoeColor: 'pink', eyewear: 'none', pattern: 'plain' } },
  { label: 'Track day', color: '#438c91', outfit: { headgear: 'visor', headColor: 'teal', clothing: 'tracksuit', accessoryColor: 'teal', trimColor: 'ivory', footwear: 'high-tops', shoeColor: 'teal', eyewear: 'none', pattern: 'plain' } },
  { label: 'Rainy day', color: '#e5c86d', outfit: { headgear: 'bucket', headColor: 'yellow', clothing: 'raincoat', accessoryColor: 'yellow', trimColor: 'orange', footwear: 'boots', shoeColor: 'orange', eyewear: 'none', pattern: 'plain' } },
]

const modeledItems = new Set<string>([...NOOT_FASHION_HATS, ...NOOT_FASHION_EYES, ...NOOT_FOOTWEAR])

function ItemIcon({ slot, id, Icon }: { slot: Slot; id: string; Icon?: typeof Shirt }) {
  if (modeledItems.has(id)) return <img src={`/mascot/wardrobe/${id}.png`} width={40} height={40} alt="" loading="lazy"/>
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
  const [pet, setPet] = useState(0), [view, setView] = useState(0)
  const [category, setCategory] = useState<Slot | 'looks'>('clothing')
  const [panel, setPanel] = useState<'items' | 'colors'>('items')
  const [colorPart, setColorPart] = useState<'main' | 'accent'>('main')
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 700px)').matches)
  const nameInput = useRef<HTMLInputElement>(null), rail = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null), editor = useRef<HTMLDivElement>(null), restoreFocus = useRef(false)
  const colorBack = useRef<HTMLButtonElement>(null)
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  const slot = category === 'looks' ? 'clothing' : category
  const options = items[slot], selectedIndex = Math.max(0, options.findIndex(o => o.id === (appearance[slot] ?? 'none'))), selected = options[selectedIndex]
  const hasAccent = slot === 'clothing' && NOOT_TAILORED.some(id => id === appearance.clothing)
  const editingAccent = hasAccent && colorPart === 'accent'
  const colorKey = editingAccent ? 'trimColor' : slot === 'headgear' ? 'headColor' : slot === 'footwear' ? 'shoeColor' : slot === 'eyewear' ? 'eyeColor' : 'accessoryColor'
  const color = appearance[colorKey] ?? (editingAccent ? '#eee7d7' : slot === 'eyewear' ? '#293431' : appearance.accessoryColor)
  const canColor = slot !== 'headgear' ? selected.id !== 'none' : ['beanie', 'bucket', ...NOOT_FASHION_HATS].includes(selected.id)
  const colorLabel = Object.hasOwn(NOOT_COLORS, color) ? NOOT_COLORS[color as keyof typeof NOOT_COLORS].label : 'Custom'
  const categoryTitle = { headgear: 'Headwear', eyewear: 'Eyewear', clothing: 'Outfits', footwear: 'Footwear', looks: 'Complete looks' }[category]
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)')
    const change = () => setNarrow(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const scroller = editor.current
    if (!scroller) return
    scroller.scrollTop = 0
    if (panel === 'colors') colorBack.current?.focus({ preventScroll: true })
  }, [category, panel])
  useEffect(() => {
    const scroller = editor.current, item = strip.current?.children[selectedIndex] as HTMLElement | undefined
    if (!scroller || !item || panel !== 'items' || category === 'looks') return
    const bounds = scroller.getBoundingClientRect(), selectedBounds = item.getBoundingClientRect()
    if (selectedBounds.top < bounds.top) scroller.scrollTop += selectedBounds.top - bounds.top - 4
    else if (selectedBounds.bottom > bounds.bottom) scroller.scrollTop += selectedBounds.bottom - bounds.bottom + 4
    if (restoreFocus.current) { item.focus({ preventScroll: true }); restoreFocus.current = false }
  }, [category, panel, selectedIndex, narrow])
  function selectCategory(value: Slot | 'looks') { setCategory(value); setPanel('items'); setColorPart('main') }
  function choose(index: number, focus = false) {
    const i = (index + options.length) % options.length
    update({ [slot]: options[i].id } as Partial<NootAppearance>)
    if (focus) (strip.current?.children[i] as HTMLElement)?.focus({ preventScroll: true })
  }
  function itemKeys(e: KeyboardEvent, index: number) {
    const next = ['ArrowRight', 'ArrowDown'].includes(e.key) ? index + 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : undefined
    if (next !== undefined) { e.preventDefault(); choose(next, true) }
  }
  function categoryKeys(e: KeyboardEvent, index: number) {
    const next = ['ArrowRight', 'ArrowDown'].includes(e.key) ? (index + 1) % categories.length : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? (index + categories.length - 1) % categories.length : e.key === 'Home' ? 0 : e.key === 'End' ? categories.length - 1 : undefined
    if (next !== undefined) { e.preventDefault(); selectCategory(categories[next].key); (rail.current?.children[next] as HTMLElement)?.focus() }
  }
  function save() {
    const result = parseSittingName(name)
    if (!result.ok) { setError('Choose a name with 2–24 characters.'); nameInput.current?.focus(); return }
    saveDisplayName(result.name); window.dispatchEvent(new Event('songguessr-profile')); onClose()
  }
  function tint(value: NootColor) { if (value !== color) update({ [colorKey]: value }) }
  return <div className="app-shell profile-shell wardrobe-shell" data-theme={theme} data-difficulty="easy" data-welcome={welcome}>
    <SettingsSheet open onClose={onClose} title={welcome ? 'Meet your Noot' : 'Your wardrobe'} closeLabel="Close customization">
      <div className="wardrobe-categories" ref={rail} role="tablist" aria-label="Customize from head to foot" aria-orientation={narrow ? 'horizontal' : 'vertical'}>
        {categories.map(({ key, label, icon: Icon }, i) => <button key={key} type="button" role="tab" aria-label={label} title={label} id={`wardrobe-tab-${key}`} aria-controls="wardrobe-items" aria-selected={category === key} tabIndex={category === key ? 0 : -1} onClick={() => selectCategory(key)} onKeyDown={e => categoryKeys(e, i)}><Icon size={24} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></button>)}
      </div>
      <div className="wardrobe-stage">
        <button type="button" className="wardrobe-pet mascot" aria-label="See an outfit gesture" onClick={() => setPet(p => p + 1)}>
          <Noot3D {...appearance} viewYaw={view} pose={pet ? 'outfit' : 'idle'} eventId={pet} difficulty="easy" theme={theme} />
        </button>
        <div className="wardrobe-angles" role="group" aria-label="Preview angle">
          {[[0, 'Front'], [.72, 'Turn'], [Math.PI, 'Back']].map(([angle, label]) => <button type="button" key={label} aria-pressed={view === angle} onClick={() => setView(Number(angle))}>{label === 'Turn' && <RotateCcw size={14} aria-hidden="true" />}{label}</button>)}
        </div>
        <span className="wardrobe-hint">Tap Noot to show it off</span>
      </div>
      <section className="wardrobe-editor" role="tabpanel" id="wardrobe-items" aria-labelledby={`wardrobe-tab-${category}`}>
        <div className="wardrobe-selection">
          <div><h3>{panel === 'colors' ? selected.label : categoryTitle}</h3><span className="wardrobe-eyebrow">{panel === 'colors' ? 'Make it yours' : category === 'looks' ? 'A whole outfit, in one tap' : `${options.length} to try on`}</span></div>
          {category !== 'looks' && canColor && panel === 'items' && <button type="button" className="wardrobe-edit-color" aria-label={slot === 'clothing' ? 'Edit color and pattern' : 'Edit color'} onClick={() => setPanel('colors')}><Palette size={18}/><span>Color</span><ChevronRight size={15}/></button>}
          {panel === 'colors' && <button ref={colorBack} type="button" aria-label="Back to items" className="wardrobe-edit-color" onClick={() => { restoreFocus.current = true; setPanel('items') }}><ChevronLeft size={16}/><span>Items</span></button>}
        </div>
        <div className="wardrobe-scroll" ref={editor}>
          {category === 'looks' ? <div className="wardrobe-look-list" aria-label="Complete looks">
            {looks.map(look => {
              const equipped = Object.entries(look.outfit).every(([key, value]) => appearance[key as keyof NootAppearance] === value)
              return <button key={look.label} type="button" aria-pressed={equipped} onClick={() => { update(look.outfit); setPet(p => p + 1) }}><i style={{ '--look-color': look.color } as CSSProperties} aria-hidden="true"><ItemIcon slot="clothing" id={look.outfit.clothing ?? 'none'}/></i><span>{look.label}<small>{items.clothing.find(item => item.id === look.outfit.clothing)?.label} · {items.footwear.find(item => item.id === look.outfit.footwear)?.label}</small></span>{equipped ? <Check size={18} aria-hidden="true"/> : <ChevronRight size={16} aria-hidden="true"/>}</button>
            })}
          </div> : panel === 'items' ? <div className="wardrobe-item-list" ref={strip} role="radiogroup" aria-label={`${categories.find(c => c.key === slot)!.label} items`}>
            {options.map((item, i) => <button key={item.id} type="button" role="radio" aria-checked={i === selectedIndex} tabIndex={i === selectedIndex ? 0 : -1} onClick={() => choose(i)} onKeyDown={e => itemKeys(e, i)}><span className="wardrobe-item-icon"><ItemIcon slot={slot} id={item.id} Icon={item.icon}/></span><span>{item.label}</span>{i === selectedIndex && <Check size={18} className="wardrobe-equipped" aria-hidden="true"/>}</button>)}
          </div> : <div className="wardrobe-color-editor">
            {hasAccent && <div className="wardrobe-color-parts" role="group" aria-label="Color section"><button type="button" aria-pressed={!editingAccent} onClick={() => setColorPart('main')}>Fabric</button><button type="button" aria-pressed={editingAccent} onClick={() => setColorPart('accent')}>Details</button></div>}
            <fieldset className="wardrobe-colors"><legend>{editingAccent ? 'Detail color' : slot === 'headgear' ? 'Hat color' : slot === 'footwear' ? 'Shoe color' : slot === 'eyewear' ? 'Frame color' : 'Fabric color'}<span>{colorLabel}</span></legend><div className="wardrobe-palette">
              {Object.entries(NOOT_COLORS).map(([value, swatch]) => <button type="button" key={value} aria-label={swatch.label} title={swatch.label} aria-pressed={color === value} style={{ '--swatch': swatch.hex } as CSSProperties} onClick={() => tint(value as NootColor)}>{color === value && <Check size={16} aria-hidden="true"/>}</button>)}
            </div></fieldset>
            <label className="wardrobe-custom"><Palette size={18} aria-hidden="true"/><span>Choose any color</span><span className="wardrobe-custom-chip" style={{background:nootColorHex(color)}}/><input type="color" aria-label="Custom color" value={nootColorHex(color)} onInput={e => tint(e.currentTarget.value as NootColor)} onChange={e => tint(e.target.value as NootColor)}/></label>
            {slot === 'clothing' && !editingAccent && <fieldset className="wardrobe-patterns"><legend>Pattern</legend><div role="group" aria-label="Fabric pattern">{patterns.map(([value, label]) => <button type="button" key={value} aria-pressed={appearance.pattern === value} onClick={() => update({pattern:value})}><i aria-hidden="true" data-pattern={value}/>{label}</button>)}</div></fieldset>}
          </div>}
        </div>
      </section>
      <form className="wardrobe-footer" onSubmit={e => { e.preventDefault(); save() }}>
        <label className="wardrobe-name"><span>Your name</span><input ref={nameInput} value={name} onChange={e => { setName(e.target.value); setError('') }} maxLength={24} autoComplete="nickname" placeholder="Your name" aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-name-error' : undefined}/></label>
        <span className="wardrobe-save-note">{persisted && <Check size={14} aria-hidden="true"/>}{persisted ? 'Outfit saved on this device' : 'Kept for this session'}</span>
        <button type="submit" className="wardrobe-done">{welcome ? 'Start listening' : 'Done'}<ArrowRight size={18} aria-hidden="true"/></button>
        {error && <p id="profile-name-error" role="alert">{error}</p>}
      </form>
    </SettingsSheet>
  </div>
}
