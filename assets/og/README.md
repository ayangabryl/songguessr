# Social-card sources

`noot-render.png` is a transparent render of our existing `assets/noot/noot.blend` character, in the Idle pose with headphones. It is used only during social-image generation; the website serves the composed `public/og.png`.

To render the character again from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b assets/noot/noot.blend --python scripts/blender/noot_og.py
```

The background render does not save changes to the source scene. It uses Cycles, 96 samples, denoising, and an orthographic camera.

Build the final 1200 × 630 card with `npm run build:og`. Add `-- --compare` to also regenerate the three design comparisons in `docs/design/og`. Card generation uses checked-in fonts and no system-font fallback for deterministic output.

The TTF fonts were converted without outline changes from the Latin regular WOFF files in the project's `@fontsource/instrument-serif` and `@fontsource/open-runde` packages, using fontTools (set `font.flavor = None` and save). Both original OFL licenses are included alongside the fonts.
