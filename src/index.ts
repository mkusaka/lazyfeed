import { Hono } from 'hono'
import { parseExpression } from 'cron-parser'

type Bindings = {
  LAZYFEED_KV: KVNamespace
}

type KVData = {
  lastFetched?: string
  cache?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/lazyfeed', async (c) => {
  const url = c.req.query('url')
  const cron = c.req.query('cron')
  
  if (!url || !cron) {
    return c.text('url and cron are required', 400)
  }

  // Cron 式の妥当性チェック
  try {
    parseExpression(cron, { utc: true })
  } catch {
    return c.text('invalid cron expression', 400)
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedCron = encodeURIComponent(cron)
  const key = `meta:${encodedUrl}:${encodedCron}`

  // KV から履歴とキャッシュを取得
  const stored = await c.env.LAZYFEED_KV.get<KVData>(key, 'json') || {}

  const now = new Date()
  let shouldFetch = false

  if (!stored.lastFetched) {
    shouldFetch = true
  } else {
    // 次の実行時刻を計算
    const next = parseExpression(cron, {
      currentDate: new Date(stored.lastFetched),
      utc: true
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
      
      // KV に保存
      await c.env.LAZYFEED_KV.put(key, JSON.stringify({
        lastFetched: now.toISOString(),
        cache: xml
      } as KVData))
      
      return c.body(xml, 200, { 'Content-Type': 'application/xml' })
    } catch {
      // フェッチエラー時はキャッシュをフォールバック
      if (stored.cache) {
        return c.body(stored.cache, 200, { 'Content-Type': 'application/xml' })
      }
      // 初回フェッチ失敗でキャッシュなしの場合
      return c.text('failed to fetch RSS', 502)
    }
  } else {
    // キャッシュ返却
    if (stored.cache) {
      return c.body(stored.cache, 200, { 'Content-Type': 'application/xml' })
    }
    // 理論上ここには到達しないはず
    return c.text('no cache available', 404)
  }
})

export default app
