import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'

describe('LazyFeed Worker Integration', () => {
  let worker: Unstable_DevWorker

  beforeAll(async () => {
    worker = await unstable_dev('./src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    })
  })

  afterAll(async () => {
    await worker.stop()
  })

  it('should return 400 for missing parameters', async () => {
    const res = await worker.fetch('/lazyfeed')
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('url and cron are required')
  })

  it('should return 400 for invalid cron', async () => {
    const res = await worker.fetch('/lazyfeed?url=https://example.com/feed.xml&cron=invalid')
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('invalid cron expression')
  })

  it('should successfully fetch and cache NASA breaking news RSS feed', async () => {
    // Using NASA's news RSS feed as a real-world example
    const url = encodeURIComponent('https://www.nasa.gov/news-release/feed/')
    const cron = encodeURIComponent('0 * * * *') // Every hour
    
    const res = await worker.fetch(`/lazyfeed?url=${url}&cron=${cron}`)
    
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    
    const content = await res.text()
    expect(content).toContain('<?xml')
    expect(content).toContain('<rss')
    expect(content).toContain('NASA')
  })

  it('should return cached content on second request', async () => {
    const url = encodeURIComponent('https://www.nasa.gov/news-release/feed/')
    const cron = encodeURIComponent('0 * * * *') // Every hour
    
    // First request
    const res1 = await worker.fetch(`/lazyfeed?url=${url}&cron=${cron}`)
    expect(res1.status).toBe(200)
    const content1 = await res1.text()
    
    // Second request (should return cached content)
    const res2 = await worker.fetch(`/lazyfeed?url=${url}&cron=${cron}`)
    expect(res2.status).toBe(200)
    const content2 = await res2.text()
    
    // Content should be identical since it's cached
    expect(content2).toBe(content1)
  })

  it('should handle different RSS feeds with various cron patterns', async () => {
    // Test with NASA Image of the Day RSS
    const imageUrl = encodeURIComponent('https://www.nasa.gov/feeds/iotd-feed/')
    const dailyCron = encodeURIComponent('0 0 * * *') // Daily at midnight
    
    const res = await worker.fetch(`/lazyfeed?url=${imageUrl}&cron=${dailyCron}`)
    
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    
    const content = await res.text()
    expect(content).toContain('<?xml')
    expect(content).toContain('<rss')
    
    // Test with different cron pattern - every 6 hours
    const techUrl = encodeURIComponent('https://www.nasa.gov/technology/feed/')
    const sixHourCron = encodeURIComponent('0 */6 * * *')
    
    const res2 = await worker.fetch(`/lazyfeed?url=${techUrl}&cron=${sixHourCron}`)
    expect(res2.status).toBe(200)
  })
})