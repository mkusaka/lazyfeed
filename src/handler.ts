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

  // Cron 式の妥当性チェック
  try {
    cronParser.parse(cron, { tz: 'UTC' })
  } catch {
    return new Response('invalid cron expression', { status: 400 })
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedCron = encodeURIComponent(cron)
  const key = `meta:${encodedUrl}:${encodedCron}`

  // KV から履歴とキャッシュを取得
  const stored = await kv.get<KVData>(key, 'json') || {}

  const now = new Date()
  let shouldFetch = false

  if (!stored.lastFetched) {
    shouldFetch = true
  } else {
    // 次の実行時刻を計算
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
      
      // KV に保存
      await kv.put(key, JSON.stringify({
        lastFetched: now.toISOString(),
        cache: xml
      } as KVData))
      
      return new Response(xml, { 
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    } catch {
      // フェッチエラー時はキャッシュをフォールバック
      if (stored.cache) {
        return new Response(stored.cache, { 
          status: 200,
          headers: { 'Content-Type': 'application/xml' }
        })
      }
      // 初回フェッチ失敗でキャッシュなしの場合
      return new Response('failed to fetch RSS', { status: 502 })
    }
  } else {
    // キャッシュ返却
    if (stored.cache) {
      return new Response(stored.cache, { 
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    }
    // 理論上ここには到達しないはず
    return new Response('no cache available', { status: 404 })
  }
}