import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const htmlPath = resolve('dist-standalone/standalone.html');
const html = await readFile(htmlPath, 'utf8');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  // This cloud browser blocks file:// by policy. Fulfill the HTML locally and
  // reject every other request to exercise the same bundle with no network.
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest() && route.request().url() === 'https://planform.invalid/') return route.fulfill({ contentType: 'text/html', body: html });
    network.push(route.request().url()); return route.abort();
  });
  await page.goto('https://planform.invalid/');
  assert.equal(await page.locator('script[src], link[rel="stylesheet"]').count(), 0, 'JavaScript and CSS must be embedded');
  await page.getByTestId('plan-canvas').waitFor();
  assert.equal(await page.locator('.furniture-hit').count(), 21);
  await page.getByRole('button', { name: '家具', exact: true }).click();
  await page.getByRole('button', { name: '三人沙發' }).click();
  assert.equal(await page.locator('.furniture-hit').count(), 22);
  await page.getByRole('button', { name: '生成配置方案' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '上側', exact: true }).click();
  await page.getByRole('button', { name: '套用此配置' }).click();
  await page.getByRole('button', { name: /3D 空間預覽/ }).click();
  const canvas = page.getByTestId('scene-3d').locator('canvas');
  await canvas.waitFor();
  assert(await canvas.evaluate(el => !!el.getContext('webgl2')));
  await page.getByRole('button', { name: '匯出圖面' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON 專案資料/ }).click();
  const backup = await downloaded;
  const data = JSON.parse(await readFile(await backup.path(), 'utf8'));
  assert.equal(data.plan.entry, 'top');
  assert.equal(network.length, 0, 'Offline HTML must make no network requests');
  assert.deepEqual(errors, []);
  console.log('PASS: standalone HTML works in an isolated page without external requests; furniture editing, entry generation, WebGL 3D and JSON export work.');
} finally { await browser.close(); }

// Keep a friendly filename for downloading.
await writeFile(resolve('dist-standalone/Planform.html'), html);
