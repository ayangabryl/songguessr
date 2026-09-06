import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
const mascot = readFileSync('public/mascot/noot-still.png').toString('base64')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#101810"/>
<text x="76" y="94" font-family="Georgia" font-size="36" fill="#f1f3e9">SongGuessr</text>
<text x="76" y="246" font-family="Georgia" font-size="78" fill="#f1f3e9">Know it in</text>
<text x="76" y="333" font-family="Georgia" font-size="78" fill="#b9db9b">a heartbeat?</text>
<text x="80" y="399" font-family="Arial" font-size="25" fill="#b2bcae">Tiny clips. Great songs. Your kind of competition.</text>
<rect x="78" y="457" width="232" height="56" rx="28" fill="#b9db9b"/>
<text x="194" y="493" text-anchor="middle" font-family="Arial" font-size="21" fill="#172315">Play with friends</text>
<image href="data:image/png;base64,${mascot}" x="725" y="97" width="410" height="410"/>
<path d="M740 531H1110" stroke="#4b6348" stroke-width="2"/>
<circle cx="798" cy="531" r="6" fill="#b9db9b"/><circle cx="900" cy="531" r="6" fill="#101810" stroke="#789071" stroke-width="2"/><circle cx="1098" cy="531" r="6" fill="#101810" stroke="#789071" stroke-width="2"/>
<text x="78" y="578" font-family="Arial" font-size="17" fill="#899984">songguessr.lol · Play solo or bring your friends</text>
</svg>`
writeFileSync('public/og.png', new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng())
