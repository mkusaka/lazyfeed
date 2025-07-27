import cronParser from 'cron-parser'

export type KVData = {
  lastFetched?: string
  cache?: string
}

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length)
  let result = a.length ^ b.length
  
  for (let i = 0; i < maxLength; i++) {
    const aChar = i < a.length ? a.charCodeAt(i) : 0
    const bChar = i < b.length ? b.charCodeAt(i) : 0
    result |= aChar ^ bChar
  }
  
  return result === 0
}

export async function handleLazyFeedRequest(
  request: Request,
  kv: KVNamespace,
  allowedDomains?: string
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

  // Validate allowed domains
  if (allowedDomains !== undefined && allowedDomains !== 'unlimited') {
    try {
      const feedUrl = new URL(url)
      const feedDomain = feedUrl.hostname.toLowerCase()
      const allowedDomainList = allowedDomains
        .split(',')
        .map(d => d.trim().toLowerCase())
        .filter(d => d.length > 0)

      // If allowedDomains is empty string or results in empty list, block all domains
      if (allowedDomainList.length === 0) {
        return new Response(`Domain ${feedDomain} is not allowed`, { status: 403 })
      }

      // Check if the feed domain is in the allowed list
      const isDomainAllowed = allowedDomainList.some(allowedDomain => {
        // Support wildcards like *.example.com
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.slice(2)
          return safeCompare(feedDomain, baseDomain) || feedDomain.endsWith('.' + baseDomain)
        }
        return safeCompare(feedDomain, allowedDomain)
      })

      if (!isDomainAllowed) {
        return new Response(`Domain ${feedDomain} is not allowed`, { status: 403 })
      }
    } catch {
      return new Response('Invalid URL format', { status: 400 })
    }
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