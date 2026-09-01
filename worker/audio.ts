const AUDIO_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function audioContentType(key: string, stored?: string): string {
  if (stored) return stored
  const lower = key.toLowerCase()
  if (lower.endsWith('.m4a') || lower.endsWith('.aac')) return 'audio/mp4'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  return 'audio/mpeg'
}

export async function serveR2Audio(
  bucket: R2Bucket,
  key: string,
  request: Request,
): Promise<Response> {
  const rangeHeader = request.headers.get('Range')

  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader)
    if (match) {
      const start = Number(match[1])
      const end = match[2] ? Number(match[2]) : undefined
      const length = end !== undefined ? end - start + 1 : undefined
      const object = await bucket.get(
        key,
        length !== undefined ? { range: { offset: start, length } } : { range: { offset: start } },
      )
      if (!object) {
        return new Response('Not Found', { status: 404 })
      }

      const total = object.size
      const contentLength = object.size
      const contentRangeEnd = end !== undefined ? end : total - 1

      return new Response(object.body, {
        status: 206,
        headers: {
          'Content-Type': audioContentType(key, object.httpMetadata?.contentType),
          'Cache-Control': AUDIO_CACHE_CONTROL,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(contentLength),
          'Content-Range': `bytes ${start}-${contentRangeEnd}/${total}`,
        },
      })
    }
  }

  const object = await bucket.get(key)
  if (!object) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': audioContentType(key, object.httpMetadata?.contentType),
      'Cache-Control': AUDIO_CACHE_CONTROL,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(object.size),
    },
  })
}
