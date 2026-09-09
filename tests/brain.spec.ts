import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type Node = { id: string; title: string; children?: Node[] }
const demo = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/demo.json', import.meta.url)), 'utf8'),
) as { children: Node[] }

// Assertions read the demo data rather than hard-coding titles, so editing the demo
// doesn't break the suite — only a real regression does.
const lenses = demo.children
const firstLens = lenses[0]
const secondLens = lenses[1]
const topTitles = firstLens.children!.map((c) => c.title)
/** A node with children, so we can drill into it. */
const branch = firstLens.children!.find((c) => c.children?.length)!

/** The canvas needs a few frames before the camera has settled and the cards are wired up. */
async function ready(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.locator('.cb-card').first()).toBeVisible()
  await page.waitForFunction(() => !!document.querySelector('canvas'))
  await page.waitForTimeout(2500)
}

// desktop alternates cards into left/right columns, so DOM order != source order
const titles = async (page: Page) => (await page.locator('.cb-card strong').allTextContents()).sort()
const sorted = (xs: string[]) => [...xs].sort()

test.describe('overview', () => {
  test('renders the brain and one card per top-level node', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await ready(page)
    expect(await titles(page)).toEqual(sorted(topTitles))
    await expect(page.locator('canvas')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('switching lens swaps the cards', async ({ page }) => {
    await ready(page)
    await page.getByRole('tab', { name: secondLens.title }).click()
    await page.waitForTimeout(1500)
    const after = await titles(page)
    expect(after).toEqual(sorted(secondLens.children!.map((c) => c.title)))
    expect(after).not.toContain(topTitles[0])
  })

  test('the toggle sits above the canvas, never over it', async ({ page }) => {
    await ready(page)
    const bar = await page.locator('.cb-topbar').boundingBox()
    const stage = await page.locator('.cb-stage').boundingBox()
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(stage!.y + 1)
  })
})

test.describe('drilling down', () => {
  test('opens a node, goes deeper, and comes back', async ({ page }) => {
    await ready(page)
    const child = branch.children!.find((c) => c.children?.length)!
    await page.locator('.cb-card', { hasText: branch.title }).first().click()
    await expect(page.locator('.cb-trail')).toContainText(branch.title)
    expect(await titles(page)).toEqual(sorted(branch.children!.map((c) => c.title)))

    await page.locator('.cb-card', { hasText: child.title }).first().click()
    await expect(page.locator('.cb-trail')).toContainText(child.title)

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.locator('.cb-trail')).toContainText(branch.title)
    await page.keyboard.press('Escape')
    await expect(page.locator('.cb-lens')).toBeVisible()
  })

  test('a leaf shows its description and nothing to click into', async ({ page }) => {
    await ready(page)
    // walk down the first branch until there is nothing left to open
    await page.locator('.cb-card', { hasText: branch.title }).first().click()
    await page.waitForTimeout(1200)
    for (let i = 0; i < 5 && (await page.locator('.cb-card').count()) > 0; i++) {
      await page.locator('.cb-card').last().click()
      await page.waitForTimeout(1300)
    }
    await expect(page.locator('.cb-leaf')).toBeVisible()
    await expect(page.locator('.cb-card')).toHaveCount(0)
  })

  test('going back clears the highlight instead of leaving it stuck', async ({ page }) => {
    await ready(page)
    await page.locator('.cb-card', { hasText: branch.title }).first().click()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Back' }).click()
    await page.waitForTimeout(1500)
    await expect(page.locator('.cb-card.is-hot')).toHaveCount(0)
    await expect(page.locator('.cb-root.has-hot')).toHaveCount(0)
  })
})

test.describe('embedding', () => {
  test('behaves as a block: no viewport lock, host styles untouched, page scrolls', async ({ page }) => {
    await ready(page, '/embed.html')
    const root = await page.locator('.cb-root').first().boundingBox()
    expect(root!.height).toBeLessThan(page.viewportSize()!.height)

    // the component must not restyle the host page
    const host = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('h1')!).color,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    }))
    expect(host.h1).toBe('rgb(17, 17, 17)')

    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.move(root!.x + root!.width / 2, root!.y + root!.height / 2)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(600)
    // scrollZoom is off by default, so the wheel belongs to the page
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
  })
})

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile layout only')

  test('cards become one horizontal strip above the brain', async ({ page }) => {
    await ready(page)
    const strip = page.locator('.cb-col-left')
    await expect(strip).toHaveCSS('overflow-x', 'auto')
    const box = await strip.boundingBox()
    const stage = await page.locator('.cb-stage').boundingBox()
    expect(box!.y).toBeLessThan(stage!.y)
    await expect(page.locator('.cb-col-right')).toBeHidden()
  })

  test('scrolling the strip highlights whichever card is centred', async ({ page }) => {
    await ready(page)
    await page.evaluate(() => {
      const s = document.querySelector('.cb-col-left')!
      s.scrollTo({ left: 900 })
      s.dispatchEvent(new Event('scroll'))
    })
    await page.waitForTimeout(800)
    await expect(page.locator('.cb-card.is-hot')).toHaveCount(1)
  })
})
