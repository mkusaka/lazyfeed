import { Hono } from 'hono'
import { handleLazyFeedRequest } from './handler'

type Bindings = {
  LAZYFEED_KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/lazyfeed', async (c) => {
  return handleLazyFeedRequest(c.req.raw, c.env.LAZYFEED_KV)
})

export default app
