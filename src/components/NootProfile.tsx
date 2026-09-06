import { useState } from "react";
import { SettingsSheet } from "./SettingsSheet";
import { Noot3D } from "./Noot3D";
import { useNootPreferences } from "../lib/noot/preferences";
import { loadDisplayName, saveDisplayName } from "../lib/player";
import { parseSittingName } from "../../shared/sitting";
import type { NootAppearance } from "../../shared/noot-profile";
export function NootProfile({ onClose, welcome = false }: { onClose: () => void; welcome?: boolean }) {
  const [appearance, update] = useNootPreferences(),
    [name, setName] = useState(loadDisplayName),
    [error, setError] = useState(""),
    [pet, setPet] = useState(0);
  const theme =
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  function save() {
    const result = parseSittingName(name);
    if (!result.ok) {
      setError("Choose a name with 2–24 characters.");
      return;
    }
    saveDisplayName(result.name);
    window.dispatchEvent(new Event("songguessr-profile"));
    onClose();
  }
  const options: {
    key: keyof NootAppearance;
    label: string;
    values: [string, string][];
  }[] = [
    {
      key: "headgear",
      label: "Headgear",
      values: [
        ["headphones", "Studio"],
        ["cat-earphones", "Kitten"],
        ["daisy", "Daisy"],
        ["none", "None"],
      ],
    },
    {
      key: "clothing",
      label: "Clothing",
      values: [
        ["none", "None"],
        ["scarf", "Soft scarf"],
        ["bow", "Bow tie"],
        ["bandana", "Bandana"],
      ],
    },
    {
      key: "eyewear",
      label: "Eyewear",
      values: [
        ["none", "None"],
        ["round", "Round frames"],
        ["sunny", "Sunglasses"],
      ],
    },
    {
      key: "accessoryColor",
      label: "Fabric color",
      values: [
        ["blue", "Blue"],
        ["rose", "Rose"],
        ["gold", "Honey"],
        ["mint", "Mint"],
        ["lavender", "Lavender"],
        ["coral", "Coral"],
        ["navy", "Ink"],
      ],
    },
    {
      key: "pattern",
      label: "Fabric pattern",
      values: [
        ["plain", "Plain"],
        ["stripes", "Stripes"],
        ["dots", "Dotted"],
        ["gingham", "Gingham"],
        ["confetti", "Confetti"],
      ],
    },
  ];
  return (
    <div
      className="app-shell profile-shell"
      data-theme={theme}
      data-difficulty="easy"
      data-welcome={welcome}
    >
      <SettingsSheet open onClose={onClose} title={welcome ? "Meet your music buddy" : "Your Noot"} closeLabel="Close customization">
        <div className="profile-preview">
        <p className="profile-intro">
          {welcome ? "Listen to a tiny clip. Name the song. A skip gives you more to hear." : "A little music buddy, wherever you play."}
        </p>
        <button
          className="profile-pet mascot"
          aria-label="Pet your Noot"
          onClick={() => setPet((p) => p + 1)}
        >
          <Noot3D
            {...appearance}
            pose={pet ? "tap" : "idle"}
            eventId={pet}
            difficulty="easy"
            theme={theme}
          />
        </button>
        <p className="profile-preview-caption">Tap Noot for a little hello</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="sit-field">
            <span>Your name</span>
            <input
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "profile-name-error" : undefined}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
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
                  onClick={() =>
                    update({
                      [key]: value,
                      ...((key === "pattern" || key === "accessoryColor") &&
                      appearance.clothing === "none"
                        ? { clothing: "bandana" as const }
                        : {}),
                    })
                  }
                >
                  {(key === "pattern" || key === "accessoryColor") && (
                    <i
                      aria-hidden="true"
                      className="wardrobe-swatch"
                      data-pattern={key === "pattern" ? value : undefined}
                      data-color={key === "accessoryColor" ? value : undefined}
                    />
                  )}
                  {title}
                </button>
              ))}
            </fieldset>
          ))}
          {error && <p id="profile-name-error" role="alert">{error}</p>}
          <p className="profile-note">
            Outfit saved automatically on this device. Your friends see it at the table.
          </p>
          <button className="profile-save" type="submit">
            {welcome ? "Start listening" : "Save name & play"}
          </button>
          {welcome && <button type="button" className="profile-later" onClick={onClose}>Play now, customize later</button>}
        </form>
      </SettingsSheet>
    </div>
  );
}
