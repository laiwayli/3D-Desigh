import * as THREE from 'three';
import type { InteriorStyle } from './interiorStyles';

export type MaterialRole = 'wood' | 'fabric' | 'accent' | 'metal' | 'stone' | 'ceramic' | 'glass' | 'dark' | 'leaf' | 'emissive' | 'leather' | 'plaster' | 'floor' | 'wetFloor' | 'screen' | 'paint' | 'rug';
type TextureKind = 'wood' | 'plank' | 'linen' | 'boucle' | 'velvet' | 'leather' | 'plaster' | 'stone' | 'concrete' | 'tile' | 'metal';

// Deterministic, local textures keep exported/offline models self contained.
const noise = (x: number, y: number, seed = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
const smoothNoise = (x: number, y: number, seed = 0) => {
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
  const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(noise(ix, iy, seed), noise(ix + 1, iy, seed), sx), THREE.MathUtils.lerp(noise(ix, iy + 1, seed), noise(ix + 1, iy + 1, seed), sx), sy);
};

function makeSurface(kind: TextureKind, textures: THREE.Texture[]) {
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!, data = context.createImageData(size, size), heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = noise(x, y), broad = smoothNoise(x / 27, y / 27), fine = smoothNoise(x / 3, y / 3);
    let shade = .94, height = .5;
    if (kind === 'wood' || kind === 'plank') {
      const wave = Math.sin(y * .58 + Math.sin(x / 49) * 1.5 + broad * .8), thread = Math.sin(y * 2.1 + Math.sin(x / 71));
      shade = .91 + wave * .035 + thread * .014 + grain * .018; height = .5 + wave * .08 + thread * .025;
      if (kind === 'plank') {
        const row = Math.floor(y / 32), seam = y % 32 < 1 || (x + row * 71) % 128 < 1;
        if (seam) { shade = .77; height = .31; } else shade += noise(row, 2) * .035;
      }
    } else if (kind === 'linen' || kind === 'velvet') {
      const weave = (Math.sin(x * Math.PI / 2) + Math.sin(y * Math.PI / 2)) / 2;
      shade = kind === 'velvet' ? .94 + fine * .045 : .91 + weave * .035 + grain * .035;
      height = .45 + weave * .19 + grain * .08;
    } else if (kind === 'boucle') {
      const loops = Math.sin(x * .9 + Math.sin(y * 1.2)) * Math.cos(y * .9 + Math.sin(x));
      shade = .9 + loops * .07 + grain * .035; height = .5 + loops * .28;
    } else if (kind === 'leather') {
      const pores = Math.pow(grain, 6), crease = Math.abs(Math.sin(x * .08 + smoothNoise(x / 10, y / 13) * 4));
      shade = .91 + fine * .055 - pores * .025 - (crease < .08 ? .035 : 0); height = .48 + fine * .16 - pores * .15;
    } else if (kind === 'stone') {
      const vein = Math.abs(Math.sin(x / 28 + y / 74 + broad * 2.3));
      shade = .95 - (vein < .06 ? .14 : vein < .12 ? .055 : 0) + grain * .018;
      height = .5 + broad * .008;
    } else if (kind === 'tile') {
      const grout = x % 64 < 2 || y % 64 < 2, motif = Math.abs((x % 64) - 32) + Math.abs((y % 64) - 32);
      shade = grout ? .69 : motif > 22 && motif < 25 ? .8 : .94 + grain * .025;
      height = grout ? .26 : .55 + fine * .015;
    } else if (kind === 'metal') {
      const brush = Math.sin(y * 2.6 + Math.sin(x / 80) * .2);
      shade = .96 + brush * .018 + grain * .012; height = .5 + brush * .12 + grain * .02;
    } else {
      const concrete = kind === 'concrete';
      shade = .91 + broad * (concrete ? .065 : .035) + grain * .025;
      height = .42 + fine * (concrete ? .2 : .13) + grain * .04;
    }
    const value = Math.round(THREE.MathUtils.clamp(shade, 0, 1) * 255), offset = (y * size + x) * 4;
    data.data[offset] = value; data.data[offset + 1] = value; data.data[offset + 2] = value; data.data[offset + 3] = 255; heights[y * size + x] = height;
  }
  context.putImageData(data, 0, 0);
  const normalCanvas = document.createElement('canvas'); normalCanvas.width = normalCanvas.height = size;
  const nc = normalCanvas.getContext('2d')!, normalData = nc.createImageData(size, size);
  const at = (x: number, y: number) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (at(x - 1, y) - at(x + 1, y)) * 1.6, ny = (at(x, y - 1) - at(x, y + 1)) * 1.6, inverse = 1 / Math.sqrt(nx * nx + ny * ny + 1), offset = (y * size + x) * 4;
    normalData.data[offset] = (nx * inverse * .5 + .5) * 255; normalData.data[offset + 1] = (ny * inverse * .5 + .5) * 255; normalData.data[offset + 2] = (inverse * .5 + .5) * 255; normalData.data[offset + 3] = 255;
  }
  nc.putImageData(normalData, 0, 0);
  const map = new THREE.CanvasTexture(canvas), normalMap = new THREE.CanvasTexture(normalCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, normalMap]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4; textures.push(texture); }
  return { map, normalMap };
}

export function createSceneMaterials(style: InteriorStyle) {
  const textures: THREE.Texture[] = [], materials = new Map<string, THREE.MeshPhysicalMaterial>(), surfaces = new Map<string, ReturnType<typeof makeSurface>>();
  const texture = (kind: TextureKind, scope = 'shared'): ReturnType<typeof makeSurface> => {
    const key = `${kind}:${scope}`; let surface = surfaces.get(key);
    if (!surface) {
      if (scope === 'shared') surface = makeSurface(kind, textures);
      else { const source = texture(kind); surface = { map: source.map.clone(), normalMap: source.normalMap.clone() }; textures.push(surface.map, surface.normalMap); }
      surfaces.set(key, surface);
    }
    return surface;
  };
  const colors: Record<MaterialRole, string> = { wood: style.wood, fabric: style.fabric, accent: style.accent, metal: style.metal, stone: style.floor, ceramic: '#f7f5ed', glass: '#d4e3df', dark: '#28302d', leaf: '#718662', emissive: '#fff1ce', leather: style.fabric, plaster: style.wall, floor: style.floor, wetFloor: '#dedbd2', screen: '#20292d', paint: style.wall, rug: style.fabric };
  const get = (role: MaterialRole, tint?: string) => {
    const key = `${role}:${tint || ''}`; let material = materials.get(key); if (material) return material;
    const p: THREE.MeshPhysicalMaterialParameters = { color: tint || colors[role], roughness: .72, metalness: 0 };
    let kind: TextureKind | undefined, scale = .12;
    if (role === 'wood') { kind = 'wood'; p.roughness = .5; p.clearcoat = .17; p.clearcoatRoughness = .5; scale = .09; }
    else if (role === 'fabric' || role === 'rug') { kind = role === 'fabric' ? style.design.upholstery : 'linen'; p.roughness = kind === 'leather' ? .57 : .96; p.sheen = kind === 'leather' ? 0 : .35; p.sheenColor = new THREE.Color(tint || style.fabric); p.sheenRoughness = .75; p.clearcoat = kind === 'leather' ? .22 : 0; scale = role === 'rug' ? .45 : .3; }
    else if (role === 'leather') { kind = 'leather'; p.roughness = .57; p.clearcoat = .22; p.clearcoatRoughness = .6; scale = .28; }
    else if (role === 'plaster') { kind = style.id === 'industrial' ? 'concrete' : 'plaster'; p.roughness = .93; scale = .14; }
    else if (role === 'stone') { kind = 'stone'; p.roughness = style.id === 'luxury' ? .22 : .48; p.clearcoat = .32; p.clearcoatRoughness = .24; scale = .045; }
    else if (role === 'floor') { kind = style.floorFinish === 'wood' ? 'plank' : style.floorFinish === 'marble' ? 'stone' : style.floorFinish; p.roughness = style.floorFinish === 'marble' ? .27 : .76; p.clearcoat = style.floorFinish === 'wood' ? .15 : .04; scale = style.floorFinish === 'wood' ? .1 : .14; }
    else if (role === 'wetFloor') { kind = 'tile'; p.roughness = .49; p.clearcoat = .18; scale = .16; }
    else if (role === 'metal') { kind = 'metal'; p.metalness = .85; p.roughness = style.id === 'industrial' ? .53 : .3; p.anisotropy = .35; scale = .045; }
    else if (role === 'ceramic') { p.roughness = .22; p.clearcoat = .6; p.clearcoatRoughness = .2; }
    else if (role === 'glass') { p.transparent = true; p.opacity = .23; p.roughness = .06; p.metalness = .08; p.ior = 1.46; p.depthWrite = false; p.side = THREE.DoubleSide; }
    else if (role === 'screen') { p.roughness = .2; p.metalness = .35; p.emissive = new THREE.Color('#1b2830'); p.emissiveIntensity = .16; }
    else if (role === 'emissive') { p.color = new THREE.Color('#fff0c9'); p.emissive = new THREE.Color('#ffd48e'); p.emissiveIntensity = 1.2; p.roughness = .5; }
    else if (role === 'leaf') { p.roughness = .79; p.side = THREE.DoubleSide; }
    else if (role === 'dark') { p.roughness = .31; p.metalness = .2; }
    else if (role === 'paint' || role === 'accent') { p.roughness = .62; p.clearcoat = style.id === 'luxury' ? .3 : .07; }
    if (kind) { const surface = texture(kind, role === 'floor' || role === 'wetFloor' ? role : 'shared'); p.map = surface.map; p.normalMap = surface.normalMap; p.normalScale = new THREE.Vector2(scale, scale); }
    material = new THREE.MeshPhysicalMaterial(p); material.name = `${style.id}:${role}`; materials.set(key, material); return material;
  };
  return { get, dispose: () => { materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
