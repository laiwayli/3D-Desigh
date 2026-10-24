import { test, expect } from '@playwright/test';
import * as THREE from 'three';

test('selects a furniture mesh directly in 3D and applies its material controls', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('planform-workspace-v1')!);
    state.plan = { ...state.plan, width: 6, depth: 6, walls: [], rooms: [], columns: undefined, excludedAreas: undefined, outline: undefined, furniture: [{ id: 'pickable-table', kind: 'roundTable', x: 3, y: 3, w: 1.2, d: 1.2, h: .75, rotation: 0 }] };
    localStorage.setItem('planform-workspace-v1', JSON.stringify(state));
  });
  await page.reload(); await page.getByRole('button', { name: /3D 空間預覽/ }).click();
  const canvas = page.getByTestId('scene-3d').locator('canvas'); await expect(canvas).toBeVisible();
  const bounds = (await canvas.boundingBox())!, camera = new THREE.PerspectiveCamera(38, bounds.width / bounds.height, .08, 200);
  camera.position.set(6 * .94, 6 * 1.48, 6 * 1.2); camera.lookAt(0, .4, 0); camera.updateMatrixWorld();
  const point = new THREE.Vector3(0, .75, 0).project(camera);
  await canvas.click({ position: { x: (point.x + 1) / 2 * bounds.width, y: (1 - point.y) / 2 * bounds.height } });
  await expect(page.getByRole('heading', { name: '圓餐桌', exact: true })).toBeVisible();
  await page.getByLabel('家具表面材質', { exact: true }).selectOption('stone');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planform-workspace-v1')!).plan.furniture[0]);
  expect(saved).toMatchObject({ id: 'pickable-table', finish: 'stone', w: 1.2, d: 1.2, h: .75 });
  await expect(canvas).toBeVisible();
});
