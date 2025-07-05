import cronParser from 'cron-parser'

export type KVData = {
  lastFetched?: string
  cache?: string
}

export async function handleLazyFeedRequest(
  request: Request,
  kv: KVNamespace
): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const cron = searchParams.get('cron')
  
  if (!url || !cron) {
    return new Response('url and cron are required', { status: 400 })
  }

  // Validate cron expression
  try {
    cronParser.parse(cron, { tz: 'UTC' })
  } catch {
    return new Response('invalid cron expression', { status: 400 })
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedCron = encodeURIComponent(cron)
  const key = `meta:${encodedUrl}:${encodedCron}`

  // Get history and cache from KV
  const stored = await kv.get<KVData>(key, 'json') || {}

  const now = new Date()
  let shouldFetch = false

  if (!stored.lastFetched) {
    shouldFetch = true
  } else {
    // Calculate next execution time
    const next = cronParser.parse(cron, {
      currentDate: new Date(stored.lastFetched),
      tz: 'UTC'
    }).next().toDate()
    
    if (now >= next) {
      shouldFetch = true
    }
  }

  if (shouldFetch) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('fetch failed')
      }
      
      const xml = await res.text()
      
      // Save to KV
      await kv.put(key, JSON.stringify({
        lastFetched: now.toISOString(),
        cache: xml
      } as KVData))
      
      return new Response(xml, { 
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    } catch {
      // Fallback to cache on fetch error
      if (stored.cache) {
        return new Response(stored.cache, { 
          status: 200,
          headers: { 'Content-Type': 'application/xml' }
        })
      }
      // First fetch failed with no cache
      return new Response('failed to fetch RSS', { status: 502 })
    }
  } else {
    // Return cache
    if (stored.cache) {
      return new Response(stored.cache, { 
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    }
    // Should not reach here in theory
    return new Response('no cache available', { status: 404 })
  }
}