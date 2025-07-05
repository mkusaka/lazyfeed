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
})