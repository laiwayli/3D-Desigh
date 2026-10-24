import * as THREE from 'three';
import { exteriorSegments } from './model';
import type { Plan, Point } from './model';
import { getInteriorStyle } from './interiorStyles';
import { buildFurnitureMesh } from './furnitureMeshes';
import type { FurnitureMaterialSet } from './furnitureMeshes';
import { createSceneMaterials } from './sceneMaterials';
import type { MaterialRole } from './sceneMaterials';

// Clip a room finish to the known building footprint without moving any walls.
function clipToRoom(points: Point[], bounds: { x: number; y: number; w: number; d: number }) {
  let output = points;
  const edges: ['x' | 'y', number, boolean][] = [['x', bounds.x, true], ['x', bounds.x + bounds.w, false], ['y', bounds.y, true], ['y', bounds.y + bounds.d, false]];
  for (const [axis, boundary, greater] of edges) {
    const input = output; output = [];
    if (!input.length) break;
    const inside = (p: Point) => greater ? p[axis] >= boundary : p[axis] <= boundary;
    const intersect = (a: Point, b: Point) => {
      const ratio = (boundary - a[axis]) / (b[axis] - a[axis]);
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    };
    let a = input[input.length - 1];
    for (const b of input) {
      if (inside(b)) { if (!inside(a)) output.push(intersect(a, b)); output.push(b); }
      else if (inside(a)) output.push(intersect(a, b));
      a = b;
    }
  }
  return output;
}

function wallInterval(a: Point, b: Point, bounds: { x: number; y: number; w: number; d: number }) {
  let start = 0, end = 1;
  for (const [axis, min, max] of [['x', bounds.x, bounds.x + bounds.w], ['y', bounds.y, bounds.y + bounds.d]] as const) {
    const distance = b[axis] - a[axis];
    if (Math.abs(distance) < 1e-8) { if (a[axis] < min - .01 || a[axis] > max + .01) return null; }
    else { const lo = (min - a[axis]) / distance, hi = (max - a[axis]) / distance; start = Math.max(start, Math.min(lo, hi)); end = Math.min(end, Math.max(lo, hi)); }
    if (end <= start) return null;
  }
  return [start, end];
}

export function populateNordicScene(scene: THREE.Scene, plan: Plan, cutaway: boolean, furniture: boolean, labels: boolean) {
  const style = getInteriorStyle(plan.style), factory = createSceneMaterials(style);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [], furnitureDisposals: (() => void)[] = [];
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    geometries.push(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, role: MaterialRole, parent: THREE.Object3D = scene, tint?: string) => mesh(new THREE.BoxGeometry(w, h, d), factory.get(role, tint), x, y, z, parent);
  const size = Math.max(plan.width, plan.depth);
  const groundMaterial = new THREE.ShadowMaterial({ color: '#655c4e', opacity: .17 }); materials.push(groundMaterial);
  const ground = mesh(new THREE.PlaneGeometry(size * 4, size * 4), groundMaterial, 0, -.24, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const footprint = plan.outline || [{ x: 0, y: 0 }, { x: plan.width, y: 0 }, { x: plan.width, y: plan.depth }, { x: 0, y: plan.depth }];
  const shapeFrom = (points: Point[], bounds?: { x: number; y: number; w: number; d: number }) => {
    const shape = new THREE.Shape();
    points.forEach((p, i) => { const x = p.x - plan.width / 2, y = plan.depth / 2 - p.y; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); }); shape.closePath();
    for (const area of plan.excludedAreas || []) {
      const left = Math.max(area.x, bounds?.x ?? -Infinity), top = Math.max(area.y, bounds?.y ?? -Infinity);
      const right = Math.min(area.x + area.w, bounds ? bounds.x + bounds.w : Infinity), bottom = Math.min(area.y + area.d, bounds ? bounds.y + bounds.d : Infinity);
      if (right <= left || bottom <= top) continue;
      const x = left - plan.width / 2, y = plan.depth / 2 - top;
      const hole = new THREE.Path(); hole.moveTo(x, y); hole.lineTo(x, y - (bottom - top)); hole.lineTo(x + right - left, y - (bottom - top)); hole.lineTo(x + right - left, y); hole.closePath(); shape.holes.push(hole);
    }
    return shape;
  };
  const floorShape = () => shapeFrom(footprint);
  const base = mesh(new THREE.ExtrudeGeometry(floorShape(), { depth: .17, bevelEnabled: false }), factory.get('paint', style.accent), 0, -.2, 0); base.rotation.x = -Math.PI / 2; base.name = 'building-base';
  const floorMaterial = factory.get('floor'); floorMaterial.map?.repeat.set(style.floorFinish === 'wood' ? .5 : 1, style.floorFinish === 'wood' ? .5 : 1); floorMaterial.normalMap?.repeat.copy(floorMaterial.map!.repeat);
  const floor = mesh(new THREE.ExtrudeGeometry(floorShape(), { depth: .05, bevelEnabled: false }), floorMaterial, 0, -.05, 0); floor.rotation.x = -Math.PI / 2; floor.name = 'main-floor';
  for (const room of plan.rooms) {
    if (!room.bounds || !['bathroom', 'kitchen', 'balcony'].includes(room.kind || '')) continue;
    const points = clipToRoom(footprint, room.bounds); if (points.length < 3) continue;
    const role = room.kind === 'balcony' ? 'stone' : 'wetFloor';
    const tint = room.kind === 'balcony' ? style.id === 'mediterranean' ? '#c9a37b' : '#c7c5b7' : style.id === 'industrial' ? '#a1a39a' : style.id === 'luxury' ? '#d5ccba' : '#e6e0d2';
    const finish = mesh(new THREE.ExtrudeGeometry(shapeFrom(points, room.bounds), { depth: .009, bevelEnabled: false }), factory.get(role, tint), 0, .0005, 0); finish.rotation.x = -Math.PI / 2; finish.name = `room-finish-${room.id || room.name}`;
  }
  [...exteriorSegments(plan), ...plan.walls].forEach(wall => {
    const exterior = wall.id.startsWith('ext-'), h = cutaway ? exterior ? .72 : 1.25 : plan.height, len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (len < .001) return;
    const group = new THREE.Group(); group.position.set((wall.a.x + wall.b.x) / 2 - plan.width / 2, 0, (wall.a.y + wall.b.y) / 2 - plan.depth / 2); group.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x); group.name = `wall-${wall.id}`; scene.add(group);
    box(len, h, wall.thickness, 0, h / 2, 0, 'plaster', group);
    box(len, .025, wall.thickness + .008, 0, h + .0125, 0, exterior ? 'dark' : 'wood', group);
    const ux = (wall.b.x - wall.a.x) / len, uy = (wall.b.y - wall.a.y) / len;
    for (const room of plan.rooms) {
      if (!room.bounds || !['bathroom', 'kitchen'].includes(room.kind || '')) continue;
      const interval = wallInterval(wall.a, wall.b, room.bounds); if (!interval) continue;
      const [start, end] = interval, at = (start + end) / 2, x = wall.a.x + ux * at * len, y = wall.a.y + uy * at * len;
      for (const sign of [-1, 1]) {
        const offset = sign * (wall.thickness / 2 + .02), px = x - uy * offset, py = y + ux * offset, bounds = room.bounds;
        if (px <= bounds.x || px >= bounds.x + bounds.w || py <= bounds.y || py >= bounds.y + bounds.d) continue;
        const bottom = room.kind === 'kitchen' ? .83 : .09, top = Math.min(h - .04, room.kind === 'kitchen' ? 1.35 : 1.05);
        if (top > bottom) box((end - start) * len, top - bottom, .008, (at - .5) * len, (top + bottom) / 2, sign * (wall.thickness / 2 + .005), 'wetFloor', group, style.id === 'industrial' ? '#b8b9ae' : '#eae6db');
      }
    }
    for (const sign of [-1, 1]) {
      const z = sign * (wall.thickness / 2 + .009);
      const trim = ['japanese', 'chinese', 'country'].includes(style.id) ? 'wood' : 'paint';
      box(len, style.id === 'luxury' ? .11 : .075, .018, 0, .05, z, trim, group, style.id === 'mediterranean' ? style.accent : undefined);
      if (style.id === 'country' || style.id === 'luxury') {
        const panelHeight = Math.min(h - .12, .56), count = Math.max(1, Math.floor(len / 1.1)), panelWidth = len / count;
        for (let i = 0; i <= count; i++) box(.018, panelHeight, .013, -len / 2 + i * panelWidth, panelHeight / 2 + .07, z, style.id === 'luxury' ? 'metal' : 'paint', group);
        box(len, .025, .02, 0, panelHeight + .07, z, style.id === 'luxury' ? 'metal' : 'paint', group);
      }
      if (style.id === 'industrial' && len > 1.5) for (let at = -len / 2 + 1.2; at < len / 2; at += 1.2) box(.006, h - .05, .004, at, h / 2, z - sign * .006, 'paint', group, '#777d76');
    }
  });
  for (const column of plan.columns || []) {
    const h = cutaway ? 1.45 : plan.height;
    const p = box(column.w, h, column.d, column.x - plan.width / 2, h / 2, column.y - plan.depth / 2, 'plaster', scene, style.id === 'industrial' ? '#8b8e85' : style.metal);
    p.name = column.status === 'estimated' ? '柱位（待核）' : '柱位';
    box(column.w + .012, .025, column.d + .012, column.x - plan.width / 2, h + .0125, column.y - plan.depth / 2, 'dark');
  }
  for (const area of plan.excludedAreas || []) {
    const x = area.x - plan.width / 2, z = area.y - plan.depth / 2;
    const points = [new THREE.Vector3(x, -.1, z), new THREE.Vector3(x + area.w, -.1, z + area.d), new THREE.Vector3(x + area.w, -.1, z), new THREE.Vector3(x, -.1, z + area.d)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points); geometries.push(geometry);
    const material = new THREE.LineDashedMaterial({ color: '#a39783', dashSize: .12, gapSize: .08 }); materials.push(material);
    const cross = new THREE.LineSegments(geometry, material); cross.computeLineDistances(); cross.name = area.name; scene.add(cross);
  }
  const furnitureMaterials: FurnitureMaterialSet = {
    wood: factory.get('wood'), fabric: factory.get('fabric'), accent: factory.get('accent'), metal: factory.get('metal'), stone: factory.get('stone'), ceramic: factory.get('ceramic'), glass: factory.get('glass'), dark: factory.get('dark'), leaf: factory.get('leaf'), emissive: factory.get('emissive'), leather: factory.get('leather'),
  };
  if (furniture) plan.furniture.forEach(item => {
    const built = buildFurnitureMesh(item, style, { cutaway, roomHeight: plan.height, materials: furnitureMaterials });
    built.group.position.set(item.x - plan.width / 2, 0, item.y - plan.depth / 2); built.group.rotation.y = -item.rotation * Math.PI / 180;
    built.group.name = `furniture-${item.id}`; built.group.userData.furnitureId = item.id; scene.add(built.group); furnitureDisposals.push(built.dispose);
  });
  if (labels) [...plan.rooms, ...(plan.excludedAreas || []).map(a => ({ name: a.name, x: a.x + a.w / 2, y: a.y + a.d / 2 })), ...(plan.reconstruction?.method === 'reference' ? [{ name: '左上外凸陽台待核', x: -1, y: 1.2 }] : [])].forEach(room => {
    const canvas = document.createElement('canvas'); canvas.width = 64 + room.name.length * 52; canvas.height = 112; const context = canvas.getContext('2d')!;
    context.fillStyle = new THREE.Color(style.accent).multiplyScalar(.6).getStyle(); context.fillRect(3, 5, canvas.width - 6, 102); context.font = '500 48px "Noto Sans TC", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#fff8e9'; context.fillText(room.name, canvas.width / 2, 56, canvas.width - 30);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture); const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }); materials.push(material); const sprite = new THREE.Sprite(material); sprite.position.set(room.x - plan.width / 2, 1.1, room.y - plan.depth / 2); sprite.scale.set(canvas.width / 112 * .37, .37, 1); sprite.renderOrder = 10; scene.add(sprite);
  });
  return () => { furnitureDisposals.forEach(dispose => dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); factory.dispose(); };
}
