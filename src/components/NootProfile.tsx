import { useState } from 'react'
import { SettingsSheet } from './SettingsSheet'
import { Noot3D } from './Noot3D'
import { useNootPreferences } from '../lib/noot/preferences'
import { loadDisplayName, saveDisplayName } from '../lib/player'
import { parseSittingName } from '../../shared/sitting'
import type { NootAppearance } from '../../shared/noot-profile'
export function NootProfile({ onClose }: { onClose: () => void }) {
  const [appearance, update] = useNootPreferences(),
    [name, setName] = useState(loadDisplayName),
    [error, setError] = useState(''),
    [pet, setPet] = useState(0)
  const theme =
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  function save() {
    const result = parseSittingName(name)
    if (!result.ok) {
      setError('Choose a name with 2–24 characters.')
      return
    }
    saveDisplayName(result.name)
    window.dispatchEvent(new Event('songguessr-profile'))
    onClose()
  }
  const options: {
    key: keyof NootAppearance
    label: string
    values: [string, string][]
  }[] = [
    {
      key: 'headgear',
      label: 'Headgear',
      values: [
        ['headphones', 'Studio'],
        ['cat-earphones', 'Kitten'],
        ['daisy', 'Daisy'],
        ['none', 'None'],
      ],
    },
    {
      key: 'clothing',
      label: 'Clothing',
      values: [
        ['none', 'None'],
        ['scarf', 'Soft scarf'],
        ['bow', 'Bow tie'],
        ['bandana', 'Bandana'],
      ],
    },
    {
      key: 'eyewear',
      label: 'Eyewear',
      values: [
        ['none', 'None'],
        ['round', 'Round frames'],
        ['sunny', 'Sunglasses'],
      ],
    },
    {
      key: 'accessoryColor',
      label: 'Fabric color',
      values: [
        ['blue', 'Blue'],
        ['rose', 'Rose'],
        ['gold', 'Honey'],
        ['mint', 'Mint'],
        ['lavender', 'Lavender'],
      ],
    },
  ]
  return (
    <div
      className="app-shell profile-shell"
      data-theme={theme}
      data-difficulty="easy"
    >
      <SettingsSheet open onClose={onClose} title="Your Noot">
        <p className="profile-intro">
          A little music buddy, wherever you play.
        </p>
        <button
          className="profile-pet mascot"
          aria-label="Pet your Noot"
          onClick={() => setPet((p) => p + 1)}
        >
          <Noot3D
            {...appearance}
            pose={pet ? 'tap' : 'idle'}
            eventId={pet}
            difficulty="easy"
            theme={theme}
          />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <label className="sit-field">
            <span>Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              placeholder="What should we call you?"
            />
          </label>
          {options.map(({ key, label, values }) => (
            <fieldset className="profile-options" key={key}>
              <legend>{label}</legend>
              {values.map(([value, title]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={appearance[key] === value}
                  onClick={() => update({ [key]: value })}
                >
                  {title}
                </button>
              ))}
            </fieldset>
          ))}
          {error && <p role="alert">{error}</p>}
          <p className="profile-note">
            Your look saves on this device and comes with you to every table.
          </p>
          <button className="profile-save" type="submit">
            Let’s play
          </button>
        </form>
      </SettingsSheet>
    </div>
  )
}
