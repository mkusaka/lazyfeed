import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main heading and description', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('LazyFeed');
    await expect(page.locator('header p')).toContainText('Smart RSS feed caching based on cron schedules');
  });

  test('should display feature cards', async ({ page }) => {
    const features = [
      { icon: 'fa-clock', title: 'Cron-based Updates', description: 'Schedule RSS updates using standard cron expressions' },
      { icon: 'fa-bolt', title: 'Lightning Fast', description: 'Serve cached content instantly when fresh' },
      { icon: 'fa-shield-alt', title: 'Reliable Fallback', description: 'Returns cached content if fetch fails' },
      { icon: 'fa-globe', title: 'Edge Powered', description: 'Runs on Cloudflare Workers globally' },
    ];

    for (const feature of features) {
      const card = page.locator('.bg-gray-800').filter({ hasText: feature.title });
      await expect(card).toBeVisible();
      await expect(card.locator('h3')).toContainText(feature.title);
      await expect(card.locator('p')).toContainText(feature.description);
    }
  });

  test('should have form fields with default values', async ({ page }) => {
    const urlInput = page.locator('#url');
    const cronInput = page.locator('#cron');
    const cronPreset = page.locator('#cronPreset');
    
    await expect(urlInput).toBeVisible();
    await expect(urlInput).toHaveValue('https://www.nasa.gov/news-release/feed/');
    
    await expect(cronInput).toBeVisible();
    await expect(cronInput).toHaveValue('0 * * * *');
    
    await expect(cronPreset).toBeVisible();
    await expect(cronPreset).toHaveValue('');
  });

  test('should generate LazyFeed URL with default values on page load', async ({ page }) => {
    const generatedUrl = page.locator('#generatedUrl');
    
    // Wait for the URL to be generated
    await page.waitForFunction(() => {
      const textarea = document.querySelector('#generatedUrl') as HTMLTextAreaElement;
      return textarea && textarea.value.length > 0;
    });
    
    const urlValue = await generatedUrl.inputValue();
    expect(urlValue).toContain('/lazyfeed?url=');
    expect(urlValue).toContain('nasa.gov');
    expect(urlValue).toContain('cron=0%20*%20*%20*%20*');
  });

  test('should update LazyFeed URL when inputs change', async ({ page }) => {
    const urlInput = page.locator('#url');
    const cronInput = page.locator('#cron');
    const generatedUrl = page.locator('#generatedUrl');
    
    // Clear and type new URL
    await urlInput.clear();
    await urlInput.fill('https://example.com/rss');
    
    // Clear and type new cron
    await cronInput.clear();
    await cronInput.fill('*/30 * * * *');
    
    // Wait for URL update
    await page.waitForFunction(() => {
      const textarea = document.querySelector('#generatedUrl') as HTMLTextAreaElement;
      return textarea && textarea.value.includes('example.com');
    });
    
    const urlValue = await generatedUrl.inputValue();
    expect(urlValue).toContain('url=https%3A%2F%2Fexample.com%2Frss');
    expect(urlValue).toContain('cron=*%2F30%20*%20*%20*%20*');
  });

  test('should update cron expression from preset', async ({ page }) => {
    const cronPreset = page.locator('#cronPreset');
    const cronInput = page.locator('#cron');
    const generatedUrl = page.locator('#generatedUrl');
    
    // Select "Every 6 hours" preset
    await cronPreset.selectOption('0 */6 * * *');
    
    await expect(cronInput).toHaveValue('0 */6 * * *');
    
    const urlValue = await generatedUrl.inputValue();
    expect(urlValue).toContain('cron=0%20*%2F6%20*%20*%20*');
  });

  test('should copy URL to clipboard', async ({ page, context, browserName }) => {
    // Skip clipboard test for Firefox and WebKit as they don't support clipboard permissions
    if (browserName === 'firefox' || browserName === 'webkit') {
      test.skip();
      return;
    }
    
    // Grant clipboard permissions for Chromium
    await context.grantPermissions(['clipboard-write']);
    
    const copyBtn = page.locator('#copyBtn');
    const generatedUrl = page.locator('#generatedUrl');
    
    // Wait for URL to be generated
    await page.waitForFunction(() => {
      const textarea = document.querySelector('#generatedUrl') as HTMLTextAreaElement;
      return textarea && textarea.value.length > 0;
    });
    
    // Click copy button
    await copyBtn.click();
    
    // Check button text changes to "Copied!"
    await expect(copyBtn).toContainText('Copied!');
    
    // Wait for button to revert
    await expect(copyBtn).toContainText('Copy URL');
  });

  test('should clear URL when input is invalid', async ({ page }) => {
    const urlInput = page.locator('#url');
    const generatedUrl = page.locator('#generatedUrl');
    const copyBtn = page.locator('#copyBtn');
    
    // Type invalid URL
    await urlInput.clear();
    await urlInput.fill('not-a-valid-url');
    
    await expect(generatedUrl).toHaveValue('');
    await expect(copyBtn).toBeDisabled();
  });

  test('should adjust textarea height dynamically', async ({ page }) => {
    const urlInput = page.locator('#url');
    const generatedUrl = page.locator('#generatedUrl');
    
    // Get initial height
    const initialHeight = await generatedUrl.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    
    // Set a very long URL
    await urlInput.clear();
    await urlInput.fill('https://example.com/very/very/very/very/very/very/very/very/very/very/long/path/to/rss/feed.xml');
    
    // Wait for height adjustment
    await page.waitForTimeout(100);
    
    const newHeight = await generatedUrl.evaluate((el: HTMLTextAreaElement) => el.offsetHeight);
    expect(newHeight).toBeGreaterThanOrEqual(initialHeight);
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check labels are associated with inputs
    const urlLabel = page.locator('label[for="url"]');
    const cronLabel = page.locator('label[for="cron"]');
    const generatedUrlLabel = page.locator('label[for="generatedUrl"]');
    
    await expect(urlLabel).toBeVisible();
    await expect(cronLabel).toBeVisible();
    await expect(generatedUrlLabel).toBeVisible();
  });

  test('should display GitHub link', async ({ page }) => {
    const githubLink = page.locator('a[href="https://github.com/mkusaka/lazyfeed"]');
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toContainText('View on GitHub');
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that cron input and preset are stacked vertically
    const cronContainer = page.locator('.flex.flex-col.sm\\:flex-row');
    await expect(cronContainer).toBeVisible();
    
    // All form elements should still be visible
    await expect(page.locator('#url')).toBeVisible();
    await expect(page.locator('#cron')).toBeVisible();
    await expect(page.locator('#cronPreset')).toBeVisible();
  });
});