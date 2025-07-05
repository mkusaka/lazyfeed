import { Hono } from 'hono'
import { handleLazyFeedRequest } from './handler'

type Bindings = {
  LAZYFEED_KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/lazyfeed', async (c) => {
  return handleLazyFeedRequest(c.req.raw, c.env.LAZYFEED_KV)
})

app.get('/', (c) => {
  const url = new URL(c.req.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LazyFeed - Smart RSS Caching Service</title>
    <meta name="description" content="LazyFeed is a smart RSS feed caching service that fetches and caches RSS feeds based on cron schedules. Schedule updates, save bandwidth, and serve content faster.">
    <meta name="keywords" content="RSS, feed, cache, cron, schedule, Cloudflare Workers, API">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${baseUrl}/">
    <meta property="og:title" content="LazyFeed - Smart RSS Caching Service">
    <meta property="og:description" content="Schedule RSS feed updates with cron expressions. Smart caching powered by Cloudflare Workers.">
    <meta property="og:image" content="${baseUrl}/og-image.png">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${baseUrl}/">
    <meta property="twitter:title" content="LazyFeed - Smart RSS Caching Service">
    <meta property="twitter:description" content="Schedule RSS feed updates with cron expressions. Smart caching powered by Cloudflare Workers.">
    <meta property="twitter:image" content="${baseUrl}/og-image.png">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="${baseUrl}/favicon.ico">
    <link rel="apple-touch-icon" href="${baseUrl}/logo.svg">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body class="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen text-white">
    <div class="container mx-auto px-4 py-12 max-w-4xl">
        <!-- Header -->
        <header class="text-center mb-12">
            <h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                LazyFeed
            </h1>
            <p class="text-xl text-gray-300">Smart RSS feed caching based on cron schedules</p>
        </header>

        <!-- Try it section -->
        <section class="bg-gray-800 rounded-lg shadow-xl p-8 mb-12">
            <h2 class="text-2xl font-semibold mb-6 flex items-center">
                <i class="fas fa-rocket mr-3 text-blue-400"></i>
                Try it out
            </h2>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">RSS Feed URL</label>
                    <input 
                        type="url" 
                        id="url" 
                        placeholder="https://www.nasa.gov/news-release/feed/"
                        class="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        value="https://www.nasa.gov/news-release/feed/"
                    >
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Cron Expression</label>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <input 
                            type="text" 
                            id="cron" 
                            placeholder="0 * * * *"
                            class="flex-1 px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                            value="0 * * * *"
                        >
                        <select id="cronPreset" class="px-4 py-2 bg-gray-700 rounded-lg cursor-pointer">
                            <option value="">Custom</option>
                            <option value="0 * * * *">Every hour</option>
                            <option value="0 */6 * * *">Every 6 hours</option>
                            <option value="0 0 * * *">Daily at midnight</option>
                            <option value="0 10 * * *">Daily at 10 AM</option>
                            <option value="0 22 * * *">Daily at 10 PM</option>
                            <option value="0 10,22 * * *">Twice daily (10 AM & 10 PM)</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="result" class="mt-6">
                <label class="block text-sm font-medium mb-2">Your LazyFeed URL:</label>
                <div class="flex flex-col gap-2">
                    <textarea 
                        id="generatedUrl" 
                        readonly 
                        rows="1"
                        class="w-full px-4 py-2 bg-gray-700 rounded-lg resize-none text-gray-400 focus:outline-none overflow-hidden"
                        placeholder="Enter RSS feed URL and cron expression above"
                        style="min-height: 2.5rem;"
                    ></textarea>
                    <button 
                        id="copyBtn"
                        class="self-end px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        disabled
                    >
                        <i class="fas fa-copy"></i>
                        <span>Copy URL</span>
                    </button>
                </div>
            </div>
        </section>

        <!-- Features -->
        <section class="grid md:grid-cols-2 gap-6 mb-12">
            <div class="bg-gray-800 p-6 rounded-lg">
                <i class="fas fa-clock text-3xl text-green-400 mb-3"></i>
                <h3 class="text-xl font-semibold mb-2">Cron-based Updates</h3>
                <p class="text-gray-300">Schedule RSS updates using standard cron expressions</p>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg">
                <i class="fas fa-bolt text-3xl text-yellow-400 mb-3"></i>
                <h3 class="text-xl font-semibold mb-2">Lightning Fast</h3>
                <p class="text-gray-300">Serve cached content instantly when fresh</p>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg">
                <i class="fas fa-shield-alt text-3xl text-blue-400 mb-3"></i>
                <h3 class="text-xl font-semibold mb-2">Reliable Fallback</h3>
                <p class="text-gray-300">Returns cached content if fetch fails</p>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg">
                <i class="fas fa-globe text-3xl text-purple-400 mb-3"></i>
                <h3 class="text-xl font-semibold mb-2">Edge Powered</h3>
                <p class="text-gray-300">Runs on Cloudflare Workers globally</p>
            </div>
        </section>

        <!-- API docs link -->
        <footer class="text-center">
            <a 
                href="https://github.com/mkusaka/lazyfeed"
                class="inline-flex items-center text-blue-400 hover:text-blue-300 transition"
            >
                <i class="fab fa-github text-2xl mr-2"></i>
                View on GitHub
            </a>
        </footer>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const urlInput = document.getElementById('url');
            const cronInput = document.getElementById('cron');
            const cronPreset = document.getElementById('cronPreset');
            const generatedUrl = document.getElementById('generatedUrl');
            const copyBtn = document.getElementById('copyBtn');

            function isValidUrl(string) {
                try {
                    new URL(string);
                    return true;
                } catch (_) {
                    return false;
                }
            }

            function adjustTextareaHeight() {
                generatedUrl.style.height = 'auto';
                generatedUrl.style.height = generatedUrl.scrollHeight + 'px';
            }

            function updateUrl() {
                const urlValue = urlInput.value.trim();
                const cronValue = cronInput.value.trim();
                
                if (urlValue && cronValue && isValidUrl(urlValue)) {
                    const baseUrl = window.location.origin + '/lazyfeed';
                    const url = encodeURIComponent(urlValue);
                    const cron = encodeURIComponent(cronValue);
                    const fullUrl = baseUrl + '?url=' + url + '&cron=' + cron;
                    
                    generatedUrl.value = fullUrl;
                    generatedUrl.classList.remove('text-gray-400');
                    generatedUrl.classList.add('text-white');
                    copyBtn.disabled = false;
                    adjustTextareaHeight();
                } else {
                    generatedUrl.value = '';
                    generatedUrl.classList.add('text-gray-400');
                    generatedUrl.classList.remove('text-white');
                    copyBtn.disabled = true;
                    adjustTextareaHeight();
                }
            }

            // Update on input changes
            urlInput.addEventListener('input', updateUrl);
            cronInput.addEventListener('input', updateUrl);

            cronPreset.addEventListener('change', (e) => {
                if (e.target.value) {
                    cronInput.value = e.target.value;
                    updateUrl();
                }
            });

            copyBtn.addEventListener('click', () => {
                generatedUrl.select();
                document.execCommand('copy');
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                }, 2000);
            });

            // Initial update
            updateUrl();
            
            // Adjust height on window resize
            window.addEventListener('resize', adjustTextareaHeight);
        });
    </script>
</body>
</html>`
  
  return c.html(html)
})

// SVG Logo for LazyFeed (RSS icon with clock)
const svgLogo = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#60A5FA;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A78BFA;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#1F2937"/>
  <g transform="translate(256, 256)">
    <!-- RSS Icon -->
    <circle cx="-120" cy="120" r="30" fill="url(#grad)"/>
    <path d="M-120 -30 Q-120 90, 0 90 L0 30 Q-60 30, -60 -30 Z" fill="none" stroke="url(#grad)" stroke-width="40"/>
    <path d="M-120 -120 Q-120 180, 90 180 L90 120 Q30 120, 30 -120 Z" fill="none" stroke="url(#grad)" stroke-width="40"/>
    <!-- Clock overlay -->
    <circle cx="80" cy="-80" r="100" fill="none" stroke="url(#grad)" stroke-width="15"/>
    <line x1="80" y1="-80" x2="80" y2="-120" stroke="url(#grad)" stroke-width="10" stroke-linecap="round"/>
    <line x1="80" y1="-80" x2="110" y2="-50" stroke="url(#grad)" stroke-width="10" stroke-linecap="round"/>
  </g>
</svg>`

// Favicon endpoint
app.get('/favicon.ico', (c) => {
  c.header('Content-Type', 'image/svg+xml')
  c.header('Cache-Control', 'public, max-age=86400')
  return c.body(svgLogo)
})

app.get('/logo.svg', (c) => {
  c.header('Content-Type', 'image/svg+xml')
  c.header('Cache-Control', 'public, max-age=86400')
  return c.body(svgLogo)
})

// OG Image endpoint
app.get('/og-image.png', (c) => {
  const url = new URL(c.req.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  // SVG-based OG image (1200x630)
  const ogImage = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1F2937;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#111827;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1F2937;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#60A5FA;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#A78BFA;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bg-gradient)"/>
    
    <!-- Logo -->
    <g transform="translate(600, 200) scale(0.5)">
      <circle cx="-120" cy="120" r="30" fill="url(#text-gradient)"/>
      <path d="M-120 -30 Q-120 90, 0 90 L0 30 Q-60 30, -60 -30 Z" fill="none" stroke="url(#text-gradient)" stroke-width="40"/>
      <path d="M-120 -120 Q-120 180, 90 180 L90 120 Q30 120, 30 -120 Z" fill="none" stroke="url(#text-gradient)" stroke-width="40"/>
      <circle cx="80" cy="-80" r="100" fill="none" stroke="url(#text-gradient)" stroke-width="15"/>
      <line x1="80" y1="-80" x2="80" y2="-120" stroke="url(#text-gradient)" stroke-width="10" stroke-linecap="round"/>
      <line x1="80" y1="-80" x2="110" y2="-50" stroke="url(#text-gradient)" stroke-width="10" stroke-linecap="round"/>
    </g>
    
    <!-- Title -->
    <text x="600" y="380" font-family="system-ui, -apple-system, sans-serif" font-size="80" font-weight="bold" text-anchor="middle" fill="url(#text-gradient)">LazyFeed</text>
    
    <!-- Tagline -->
    <text x="600" y="450" font-family="system-ui, -apple-system, sans-serif" font-size="32" text-anchor="middle" fill="#D1D5DB">Smart RSS feed caching based on cron schedules</text>
    
    <!-- URL -->
    <text x="600" y="550" font-family="system-ui, -apple-system, sans-serif" font-size="24" text-anchor="middle" fill="#9CA3AF">${baseUrl}</text>
  </svg>`
  
  c.header('Content-Type', 'image/svg+xml')
  c.header('Cache-Control', 'public, max-age=86400')
  return c.body(ogImage)
})

export default app
