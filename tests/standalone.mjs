import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { floorplanPdf } from './fixtures.mjs';
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
  await page.getByRole('button', { name: '2D 平面設計' }).click();
  await page.getByRole('button', { name: '空間', exact: true }).click();
  await page.getByRole('button', { name: '匯入圖片／PDF 平面圖' }).click();
  await page.getByLabel('選擇平面圖檔案').setInputFiles({ name: 'offline-plan.pdf', mimeType: 'application/pdf', buffer: floorplanPdf() });
  await page.getByRole('img', { name: '匯入平面圖預覽' }).waitFor({ timeout: 20000 });
  await page.getByLabel('PDF 頁面', { exact: true }).selectOption('2');
  await page.waitForFunction(() => document.querySelector('.pdf-annotations')?.textContent.includes('2500'));
  await page.getByRole('button', { name: '匯入並校正比例' }).click();
  const drawing = await page.getByTestId('floorplan-underlay').getAttribute('href');
  assert(drawing.startsWith('data:image/jpeg;base64,'));
  const coordinates = await page.getByTestId('plan-canvas').evaluate(svg => [new DOMPoint(2, 2), new DOMPoint(6, 2)].map(p => { const q = p.matrixTransform(svg.getScreenCTM()); return { x: q.x, y: q.y }; }));
  for (const p of coordinates) await page.mouse.click(p.x, p.y);
  await page.getByLabel('已知距離', { exact: true }).fill('4000');
  await page.getByRole('button', { name: '套用標註尺寸' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('planform-workspace-v1')).plan.underlay?.calibratedDistance === 4);
  const calibrated = await page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')).plan.underlay.calibratedDistance);
  assert.equal(calibrated, 4);
  assert.equal(network.length, 0, 'Offline HTML must make no network requests');
  assert.deepEqual(errors, []);
  console.log('PASS: standalone HTML works in an isolated page without external requests; furniture editing, entry generation, WebGL 3D, JSON export, offline PDF page selection and dimension calibration work.');
} finally { await browser.close(); }

// Keep a friendly filename for downloading.
await writeFile(resolve('dist-standalone/Planform.html'), html);
