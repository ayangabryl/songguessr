const trackId = process.argv[2] ?? '1z2PG1LTiZXA4n8f3R7qMJ'
const response = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})

console.log('status', response.status)
const html = await response.text()
console.log('len', html.length)
console.log('has __NEXT_DATA__', html.includes('__NEXT_DATA__'))
console.log('has p.scdn.co', html.includes('p.scdn.co'))

const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/)
if (nextMatch) {
  const data = JSON.parse(nextMatch[1])
  console.log('top keys', Object.keys(data))
  console.log('pageProps keys', Object.keys(data?.props?.pageProps ?? {}))
  console.log('state keys', Object.keys(data?.props?.pageProps?.state ?? {}))
  console.log('data keys', Object.keys(data?.props?.pageProps?.state?.data ?? {}))
  const entity = data?.props?.pageProps?.state?.data?.entity
  console.log('entity', entity)
  console.log('stringified snippet', JSON.stringify(data).slice(0, 1200))
}

const previewMatches = [...html.matchAll(/https:\\\/\\\/p\.scdn\.co[^"\\]+/g)].slice(0, 3)
console.log('escaped previews', previewMatches.map((m) => m[0]))
