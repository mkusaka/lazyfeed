import { vi, describe, it, expect, beforeEach } from 'vitest'
import { handleLazyFeedRequest } from './handler'

// Mock KV namespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
}

describe('handleLazyFeedRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should return 400 when url is missing', async () => {
    const req = new Request('http://localhost/lazyfeed?cron=0%20*%20*%20*%20*')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('url and cron are required')
  })

  it('should return 400 when cron is missing', async () => {
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('url and cron are required')
  })

  it('should return 400 for invalid cron expression', async () => {
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml&cron=invalid')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('invalid cron expression')
  })

  it('should fetch RSS on first request', async () => {
    const now = new Date('2025-01-01T10:00:00Z')
    vi.setSystemTime(now)
    
    const mockRSSContent = '<?xml version="1.0"?><rss><channel><title>Test</title></channel></rss>'
    
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockRSSContent,
    })
    
    // KV returns null for first request
    mockKV.get.mockResolvedValue(null)
    
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml&cron=0%20*%20*%20*%20*')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    expect(res.headers.get('x-cache-status')).toBe('miss')
    expect(res.headers.get('x-fetched-at')).toBe(now.toISOString())
    expect(await res.text()).toBe(mockRSSContent)
    
    // Check KV put was called
    expect(mockKV.put).toHaveBeenCalledWith(
      'meta:https%3A%2F%2Fexample.com%2Ffeed.xml:0%20*%20*%20*%20*',
      expect.any(String)
    )
    
    // Verify the stored data
    const putCall = mockKV.put.mock.calls[0]
    const storedData = JSON.parse(putCall[1])
    expect(storedData).toHaveProperty('lastFetched')
    expect(storedData).toHaveProperty('cache', mockRSSContent)
  })

  it('should return cached content when not time to refetch', async () => {
    const cachedContent = '<?xml version="1.0"?><rss><channel><title>Cached</title></channel></rss>'
    const now = new Date('2025-01-01T10:30:00Z')
    vi.setSystemTime(now)
    
    const lastFetched = new Date('2025-01-01T10:00:00Z').toISOString() // 30 minutes ago
    
    mockKV.get.mockResolvedValue({
      lastFetched,
      cache: cachedContent,
    })
    
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml&cron=0%20*%20*%20*%20*')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    expect(res.headers.get('x-cache-status')).toBe('hit')
    expect(res.headers.get('x-last-fetched')).toBe(lastFetched)
    expect(res.headers.get('x-cache-age-seconds')).toBe('1800')
    expect(res.headers.get('x-next-fetch')).toBe('2025-01-01T11:00:00.000Z')
    expect(await res.text()).toBe(cachedContent)
    
    // Fetch should not be called
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should refetch when cron schedule indicates', async () => {
    const cachedContent = '<?xml version="1.0"?><rss><channel><title>Old</title></channel></rss>'
    const newContent = '<?xml version="1.0"?><rss><channel><title>New</title></channel></rss>'
    
    const now = new Date('2025-01-01T11:01:00Z')
    vi.setSystemTime(now)
    
    const lastFetched = new Date('2025-01-01T10:00:00Z').toISOString() // 61 minutes ago
    
    mockKV.get.mockResolvedValue({
      lastFetched,
      cache: cachedContent,
    })
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => newContent,
    })
    
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml&cron=0%20*%20*%20*%20*')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    
    expect(res.status).toBe(200)
    expect(res.headers.get('x-cache-status')).toBe('miss')
    expect(res.headers.get('x-fetched-at')).toBe(now.toISOString())
    expect(await res.text()).toBe(newContent)
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('should fallback to cache on fetch error', async () => {
    const cachedContent = '<?xml version="1.0"?><rss><channel><title>Cached</title></channel></rss>'
    
    const now = new Date('2025-01-01T11:01:00Z')
    vi.setSystemTime(now)
    
    const lastFetched = new Date('2025-01-01T10:00:00Z').toISOString()
    
    mockKV.get.mockResolvedValue({
      lastFetched,
      cache: cachedContent,
    })
    
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml&cron=0%20*%20*%20*%20*')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    
    expect(res.status).toBe(200)
    expect(res.headers.get('x-cache-status')).toBe('stale')
    expect(res.headers.get('x-fetch-error')).toBe('Network error')
    expect(await res.text()).toBe(cachedContent)
  })

  it('should return 502 on first fetch failure', async () => {
    mockKV.get.mockResolvedValue(null)
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    const req = new Request('http://localhost/lazyfeed?url=https://example.com/feed.xml&cron=0%20*%20*%20*%20*')
    const res = await handleLazyFeedRequest(req, mockKV as any)
    
    expect(res.status).toBe(502)
    expect(res.headers.get('x-cache-status')).toBe('error')
    expect(res.headers.get('x-fetch-error')).toBe('Network error')
    expect(await res.text()).toBe('failed to fetch RSS')
  })
})