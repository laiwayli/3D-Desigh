import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { exteriorSegments } from './model';
import type { Plan } from './model';

const C = { ivory: '#f7f2e9', linen: '#e8dfcf', oak: '#d0b28a', taupe: '#b79b7d', dark: '#4e504a', brass: '#b49b71' };

export function populateNordicScene(scene: THREE.Scene, plan: Plan, cutaway: boolean, furniture: boolean, labels: boolean) {
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const grain = document.createElement('canvas'); grain.width = 512; grain.height = 512;
  const ctx = grain.getContext('2d')!; ctx.fillStyle = '#d3b991'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 230; i++) {
    ctx.strokeStyle = `rgba(109,78,44,${.025 + (i % 7) * .006})`; ctx.lineWidth = i % 8 === 0 ? 2 : .5;
    ctx.beginPath(); ctx.moveTo(0, i * 2.3); for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, i * 2.3 + Math.sin(x / 100 + i * 1.7) * 4); ctx.stroke();
  }
  const wood = new THREE.CanvasTexture(grain); wood.colorSpace = THREE.SRGBColorSpace; wood.wrapS = wood.wrapT = THREE.RepeatWrapping; textures.push(wood);
  const mat = (color: string, oak = false) => {
    const key = color + oak; let m = materialCache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: oak ? '#ffffff' : color, map: oak ? wood : null, roughness: oak ? .78 : .9 }); materials.push(m); materialCache.set(key, m); }
    return m;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
    geometries.push(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, parent: THREE.Object3D = scene, rounded = false, oak = false) => mesh(rounded ? new RoundedBoxGeometry(w, h, d, 2, Math.min(.06, w / 5, h / 5, d / 5)) : new THREE.BoxGeometry(w, h, d), mat(color, oak), x, y, z, parent);
  const cylinder = (top: number, bottom: number, h: number, x: number, y: number, z: number, color: string, parent: THREE.Object3D) => mesh(new THREE.CylinderGeometry(top, bottom, h, 20), mat(color), x, y, z, parent);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe5a9', emissive: '#ffc66b', emissiveIntensity: 1.5, roughness: .7 }); materials.push(glowMat);
  const glow = (w: number, x: number, y: number, z: number, parent: THREE.Object3D) => mesh(new THREE.BoxGeometry(w, .018, .025), glowMat, x, y, z, parent);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#dce2d9', transparent: true, opacity: .22, roughness: .1, metalness: .05, depthWrite: false, side: THREE.DoubleSide }); materials.push(glass);
  const plant = (x: number, y: number, z: number, size: number, parent: THREE.Object3D) => {
    cylinder(size * .3, size * .23, size * .4, x, y + size * .2, z, '#cbb997', parent);
    cylinder(size * .24, size * .24, .015, x, y + size * .405, z, '#675d49', parent);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, r = size * (.08 + (i % 3) * .1);
      const leaf = mesh(new THREE.SphereGeometry(1, 12, 8), mat(i % 2 ? '#8a9c73' : '#6f8559'), x + Math.cos(a) * r, y + size * (.65 + (i % 3) * .1), z + Math.sin(a) * r, parent);
      leaf.scale.set(size * .12, size * .36, size * .06); leaf.rotation.set(Math.sin(a) * .5, a, Math.cos(a) * .6);
    }
  };
  const legs = (w: number, d: number, h: number, parent: THREE.Object3D) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.045, h, .045, sx * (w / 2 - .1), h / 2, sz * (d / 2 - .1), C.oak, parent, false, true); };
  const size = Math.max(plan.width, plan.depth);
  const groundMaterial = new THREE.ShadowMaterial({ color: '#75654e', opacity: .18 }); materials.push(groundMaterial);
  const ground = mesh(new THREE.PlaneGeometry(size * 4, size * 4), groundMaterial, 0, -.24, 0, scene); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  box(plan.width + .25, .17, plan.depth + .25, 0, -.15, 0, '#c9bca7');
  const floorWood = wood.clone(); floorWood.repeat.set(plan.width / 2.4, plan.depth / 1.5); textures.push(floorWood);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#f3e8d5', map: floorWood, roughness: .83 }); materials.push(floorMat);
  mesh(new THREE.BoxGeometry(plan.width, .05, plan.depth), floorMat, 0, -.035, 0, scene);
  for (let z = .2; z < plan.depth; z += .22) {
    box(plan.width, .002, .005, 0, -.006, z - plan.depth / 2, '#c5b494');
    for (let x = (Math.round(z / .22) % 3) * .75; x < plan.width; x += 2.2) box(.005, .002, .22, x - plan.width / 2, -.005, z - plan.depth / 2 - .11, '#cbb99a');
  }
  [...exteriorSegments(plan), ...plan.walls].forEach(w => {
    const exterior = w.id.startsWith('ext-'), h = cutaway ? exterior ? .72 : 1.25 : plan.height, len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const g = new THREE.Group(); g.position.set((w.a.x + w.b.x) / 2 - plan.width / 2, 0, (w.a.y + w.b.y) / 2 - plan.depth / 2); g.rotation.y = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x); scene.add(g);
    box(len, h, w.thickness, 0, h / 2, 0, C.ivory, g); box(len, .025, w.thickness + .008, 0, h + .0125, 0, exterior ? C.dark : '#b7aa94', g);
    for (const sign of [-1, 1]) box(len, .075, .018, 0, .05, sign * (w.thickness / 2 + .009), '#c9b596', g);
    if (exterior && len > 2.5) glow(len * .7, 0, h - .05, -.5 * w.thickness - .015, g);
  });
  if (furniture) plan.furniture.forEach(f => {
    const g = new THREE.Group(); g.position.set(f.x - plan.width / 2, 0, f.y - plan.depth / 2); g.rotation.y = -f.rotation * Math.PI / 180; scene.add(g);
    const { w, d } = f;
    if (f.kind === 'sofa') {
      box(w + .45, .018, d + 1.6, 0, .008, d * .6, '#e0d2b9', g, true);
      for (let i = 0; i < 9; i++) box(w + .35, .003, .007, 0, .02, d * .6 - (d + 1.4) / 2 + i * (d + 1.4) / 8, '#d1c3aa', g);
      legs(w, d, .13, g); box(w, .24, d, 0, .23, 0, C.taupe, g, true); box(w, .54, .19, 0, .56, -d / 2 + .095, C.linen, g, true);
      for (const side of [-1, 1]) box(.16, .38, d, side * (w / 2 - .08), .46, 0, C.linen, g, true);
      const count = Math.max(2, Math.round(w / .8));
      for (let i = 0; i < count; i++) { const x = -w / 2 + .18 + (i + .5) * (w - .36) / count; box((w - .36) / count - .025, .18, d - .23, x, .43, .06, '#eee5d5', g, true); const pillow = box(Math.min(.38, w / count - .08), .36, .15, x, .65, -d * .2, i % 2 ? '#c7b296' : '#f9f3e7', g, true); pillow.rotation.x = -.16; pillow.rotation.z = (i % 2 ? 1 : -1) * .12; }
    } else if (f.kind === 'chair') {
      legs(w, d, .4, g); box(w, .1, d, 0, .45, 0, C.linen, g, true); box(w, .38, .065, 0, .67, -d / 2 + .04, C.oak, g, true, true);
    } else if (f.kind === 'bed') {
      box(w + .35, .018, d + .35, 0, .01, .05, '#dfd3bf', g, true); box(w, .28, d, 0, .24, 0, C.oak, g, true, true); box(w - .04, .18, d - .04, 0, .46, 0, C.ivory, g, true); box(w + .04, 1, .12, 0, .5, -d / 2, C.oak, g, true, true); box(w - .03, .12, d * .66, 0, .59, d * .14, '#d2c4af', g, true);
      for (const sign of [-1, 1]) box(w * .38, .15, d * .2, sign * w * .23, .6, -d * .32, '#faf5ea', g, true);
      for (let i = 0; i < 5; i++) box(w - .1, .009, .012, 0, .655, d * .03 + i * d * .09, '#c2b399', g, true);
    } else if (f.kind === 'table' || f.kind === 'desk') {
      const h = f.kind === 'table' && d < .75 ? .39 : .74; legs(w, d, h - .04, g); box(w, .075, d, 0, h, 0, C.oak, g, true, true);
      if (f.kind === 'desk') { box(w * .43, .36, .035, 0, h + .27, -d * .23, C.dark, g, true); box(w * .39, .3, .012, 0, h + .27, -d * .23 + .023, '#777d6e', g); box(.045, .11, .08, 0, h + .08, -d * .23, C.dark, g); box(w * .31, .025, d * .2, 0, h + .06, d * .14, '#c7c5b9', g, true); plant(w * .37, h + .04, -d * .14, .19, g); }
      else { plant(w * .12, h + .04, 0, .22, g); cylinder(.12, .12, .018, -w * .27, h + .05, .07, C.ivory, g); cylinder(.045, .035, .07, -w * .27, h + .095, .07, '#a99271', g); }
    } else if (f.kind === 'plant') plant(0, 0, 0, w * 1.35, g);
    else if (f.kind === 'wardrobe') {
      const h = cutaway ? 1.6 : Math.min(2.35, plan.height - .1); box(w, h, d, 0, h / 2, 0, C.ivory, g); const count = Math.max(2, Math.round(w / .55));
      for (let i = 0; i < count; i++) { const x = -w / 2 + (i + .5) * w / count; box(w / count - .015, h - .08, .022, x, h / 2 + .02, d / 2 + .01, i === 0 ? C.oak : '#e6dccb', g, false, i === 0); box(.012, .23, .025, x + w / count * .32, h * .53, d / 2 + .035, C.brass, g); } glow(w - .06, 0, .06, d / 2 + .02, g);
    } else if (f.kind === 'shower') {
      box(w, .035, d, 0, .02, 0, '#d9d4c8', g); const h = cutaway ? 1.3 : Math.min(2.1, plan.height - .2);
      mesh(new THREE.BoxGeometry(.012, h, d), glass, -w / 2, h / 2, 0, g); mesh(new THREE.BoxGeometry(w, h, .012), glass, 0, h / 2, d / 2, g); box(w, .025, .025, 0, h, d / 2, C.dark, g); box(.025, h, .025, -w / 2, h / 2, d / 2, C.dark, g); cylinder(.09, .09, .025, w * .15, h - .1, -d * .26, C.brass, g);
    } else if (f.kind === 'toilet') {
      box(w * .75, .38, d * .7, 0, .23, .06, C.ivory, g, true); box(w * .87, .09, d * .67, 0, .46, .08, '#fffdf6', g, true); box(w * .88, .63, .18, 0, .34, -d / 2 + .1, C.ivory, g, true);
    } else {
      const h = .86 * Math.min(1, w / .6, d / .5); box(w, h, d, 0, h / 2, 0, C.ivory, g); box(w + .025, .045, d + .025, 0, h + .0225, 0, '#f4ecdc', g); const count = Math.max(2, Math.round(w / .55));
      for (let i = 1; i < count; i++) box(.008, h - .07, .012, -w / 2 + i * w / count, h / 2, d / 2 + .009, '#cbbd9f', g); box(w * .24, .018, d * .57, -w * .24, h + .053, 0, '#a9a99c', g, true); cylinder(.018, .018, .19, -w * .24, h + .13, -d * .27, C.brass, g);
      if (w > 1.8) for (let i = 0; i < 2; i++) cylinder(d * .13, d * .13, .008, w * .24 + i * d * .3, h + .05, 0, C.dark, g); glow(w - .05, 0, .045, d / 2 + .02, g);
    }
  });
  if (labels) plan.rooms.forEach(room => {
    const canvas = document.createElement('canvas'); canvas.width = 64 + room.name.length * 52; canvas.height = 112; const c = canvas.getContext('2d')!;
    c.fillStyle = '#806d57e8'; c.fillRect(3, 5, canvas.width - 6, 102); c.font = '500 48px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff8e9'; c.fillText(room.name, canvas.width / 2, 56, canvas.width - 30);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture); const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }); materials.push(material); const sprite = new THREE.Sprite(material); sprite.position.set(room.x - plan.width / 2, 1.1, room.y - plan.depth / 2); sprite.scale.set(canvas.width / 112 * .37, .37, 1); sprite.renderOrder = 10; scene.add(sprite);
  });
  return () => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); };
}
