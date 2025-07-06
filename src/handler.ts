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
  let nextFetch: Date | null = null

  if (!stored.lastFetched) {
    shouldFetch = true
  } else {
    // Calculate next execution time
    const next = cronParser.parse(cron, {
      currentDate: new Date(stored.lastFetched),
      tz: 'UTC'
    }).next().toDate()
    nextFetch = next
    
    if (now >= next) {
      shouldFetch = true
    }
  }

  // Prepare debug headers
  const debugHeaders = new Headers({
    'Content-Type': 'application/xml',
    'x-cache-key': key,
    'x-cron-expression': cron,
    'x-feed-url': url,
    'x-current-time': now.toISOString()
  })

  if (stored.lastFetched) {
    debugHeaders.set('x-last-fetched', stored.lastFetched)
    const cacheAge = Math.floor((now.getTime() - new Date(stored.lastFetched).getTime()) / 1000)
    debugHeaders.set('x-cache-age-seconds', cacheAge.toString())
  }

  if (nextFetch) {
    debugHeaders.set('x-next-fetch', nextFetch.toISOString())
  }

  if (shouldFetch) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`fetch failed with status ${res.status}`)
      }
      
      const xml = await res.text()
      
      // Save to KV
      await kv.put(key, JSON.stringify({
        lastFetched: now.toISOString(),
        cache: xml
      } as KVData))
      
      debugHeaders.set('x-cache-status', 'miss')
      debugHeaders.set('x-fetched-at', now.toISOString())
      
      return new Response(xml, { 
        status: 200,
        headers: debugHeaders
      })
    } catch (error) {
      // Fallback to cache on fetch error
      if (stored.cache) {
        debugHeaders.set('x-cache-status', 'stale')
        debugHeaders.set('x-fetch-error', error instanceof Error ? error.message : 'unknown error')
        
        return new Response(stored.cache, { 
          status: 200,
          headers: debugHeaders
        })
      }
      // First fetch failed with no cache
      debugHeaders.set('x-cache-status', 'error')
      debugHeaders.set('x-fetch-error', error instanceof Error ? error.message : 'unknown error')
      
      return new Response('failed to fetch RSS', { 
        status: 502,
        headers: debugHeaders
      })
    }
  } else {
    // Return cache
    if (stored.cache) {
      debugHeaders.set('x-cache-status', 'hit')
      
      return new Response(stored.cache, { 
        status: 200,
        headers: debugHeaders
      })
    }
    // Should not reach here in theory
    debugHeaders.set('x-cache-status', 'error')
    
    return new Response('no cache available', { 
      status: 404,
      headers: debugHeaders
    })
  }
}