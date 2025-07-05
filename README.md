# LazyFeed

A smart RSS feed caching service built on Cloudflare Workers that fetches and caches RSS feeds based on cron schedules.

## Features

- 🚀 **On-demand RSS fetching** - Fetches RSS feeds only when needed based on cron expressions
- ⏰ **Cron-based scheduling** - Supports standard cron expressions for flexible update schedules
- 💾 **KV-based caching** - Uses Cloudflare Workers KV for persistent caching
- 🔄 **Smart refresh** - Only fetches new content when the schedule indicates it's time
- 🛡️ **Fallback mechanism** - Returns cached content if fetch fails
- ⚡ **Fast response times** - Serves cached content instantly when fresh

## API Usage

### Endpoint

```
GET /lazyfeed?url=<RSS_URL>&cron=<CRON_EXPRESSION>
```

### Parameters

- `url` (required): The RSS feed URL to fetch (URL encoded)
- `cron` (required): Cron expression for update schedule (URL encoded)

### Example Request

```bash
# Fetch NASA news feed every hour
curl "https://your-worker.workers.dev/lazyfeed?url=https%3A%2F%2Fwww.nasa.gov%2Fnews-release%2Ffeed%2F&cron=0%20*%20*%20*%20*"
```

### Cron Expression Examples

- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight
- `0 0 * * 1` - Weekly on Mondays
- `*/15 * * * *` - Every 15 minutes

### Response

- **200 OK**: Returns the RSS XML content with `Content-Type: application/xml`
- **400 Bad Request**: Missing parameters or invalid cron expression
- **502 Bad Gateway**: Failed to fetch RSS and no cache available

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account (for deployment)

### Installation

```bash
pnpm install
```

### Local Development

```bash
pnpm run dev
```

This starts a local development server using Wrangler at `http://localhost:8787`.

### Type Generation

Generate TypeScript types from your Cloudflare bindings:

```bash
pnpm run cf-typegen
```

### Testing

Run unit and integration tests:

```bash
# Run all tests
pnpm run test

# Run tests with UI
pnpm run test:ui
```

### Type Checking

```bash
pnpm run typecheck
```

## Deployment

### 1. Create KV Namespace

```bash
pnpm wrangler kv:namespace create LAZYFEED_KV
```

### 2. Update wrangler.jsonc

Add the namespace ID from the previous command to `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "LAZYFEED_KV",
      "id": "your-namespace-id-here"
    }
  ]
}
```

### 3. Deploy

```bash
pnpm run deploy
```

## Architecture

### Technology Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight web framework)
- **Storage**: Cloudflare Workers KV
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Testing**: Vitest + Miniflare
- **CI/CD**: GitHub Actions

### How It Works

1. **Request arrives** with RSS URL and cron expression
2. **Validation** ensures parameters are present and cron is valid
3. **Cache check** - Looks for existing feed data in KV store
4. **Schedule evaluation** - Determines if it's time to refresh based on cron
5. **Fetch or serve**:
   - If refresh needed: Fetches new content, caches it, returns it
   - If not: Returns cached content immediately
6. **Error handling** - Falls back to cache on fetch failures

### KV Storage Structure

Keys are formatted as:
```
meta:{encodedURL}:{encodedCron}
```

Values contain:
```json
{
  "lastFetched": "2025-01-01T00:00:00.000Z",
  "cache": "<rss>...</rss>"
}
```

## CI/CD

GitHub Actions workflow runs on push and PR:

- **Test**: Runs TypeScript checks and all tests
- **Lint**: Ensures code quality
- **Build**: Verifies the Worker builds successfully

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built with [Hono](https://hono.dev/) framework
- Powered by [Cloudflare Workers](https://workers.cloudflare.com/)
- Cron parsing by [cron-parser](https://github.com/harrisiirak/cron-parser)