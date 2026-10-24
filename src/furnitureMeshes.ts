import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Furniture } from './model';
import { catalog } from './model';
import type { InteriorStyle, StyleId } from './interiorStyles';

export type FurnitureMaterialRole = 'wood' | 'fabric' | 'accent' | 'metal' | 'stone' | 'ceramic' | 'glass' | 'dark' | 'leaf' | 'emissive';
export type FurnitureMaterialSet = Record<FurnitureMaterialRole, THREE.Material> & { leather?: THREE.Material };
export type FurnitureMeshOptions = { cutaway: boolean; roomHeight: number; materials?: Partial<FurnitureMaterialSet>; mergeParts?: boolean };
export type FurnitureMesh = { group: THREE.Group; dispose: () => void };

type Profile = { radius: number; leg: 'taper' | 'tube' | 'plinth' | 'turned' | 'frame'; panel: 'plain' | 'slat' | 'frame' | 'flute' | 'lattice'; low: boolean; soft: boolean; pedestal: boolean; stoneTop: boolean };
export const furnitureStyleProfiles: Record<StyleId, Profile> = {
  nordic: { radius: .035, leg: 'taper', panel: 'slat', low: false, soft: true, pedestal: false, stoneTop: false },
  japanese: { radius: .008, leg: 'frame', panel: 'slat', low: true, soft: false, pedestal: false, stoneTop: false },
  wabisabi: { radius: .085, leg: 'plinth', panel: 'plain', low: true, soft: true, pedestal: true, stoneTop: true },
  minimal: { radius: .004, leg: 'plinth', panel: 'plain', low: false, soft: false, pedestal: false, stoneTop: false },
  industrial: { radius: .012, leg: 'frame', panel: 'plain', low: false, soft: false, pedestal: false, stoneTop: false },
  luxury: { radius: .025, leg: 'tube', panel: 'flute', low: false, soft: true, pedestal: true, stoneTop: true },
  cream: { radius: .12, leg: 'plinth', panel: 'flute', low: false, soft: true, pedestal: true, stoneTop: false },
  country: { radius: .025, leg: 'turned', panel: 'frame', low: false, soft: true, pedestal: false, stoneTop: false },
  chinese: { radius: .006, leg: 'frame', panel: 'lattice', low: false, soft: false, pedestal: false, stoneTop: false },
  mediterranean: { radius: .055, leg: 'turned', panel: 'frame', low: false, soft: true, pedestal: true, stoneTop: true },
};

/** Local origin is the centre of the footprint; the scene owns placement and rotation. */
export function buildFurnitureMesh(f: Furniture, style: InteriorStyle, options: FurnitureMeshOptions): FurnitureMesh {
  const group = new THREE.Group(), geometries = new Set<THREE.BufferGeometry>(), ownedMaterials = new Set<THREE.Material>();
  const config = f as Furniture & { h?: number; color?: string; finish?: string };
  const design = (style as InteriorStyle & { design?: { seating?: string; cabinetry?: string; tables?: string; lighting?: string; rug?: string } }).design;
  const baseProfile = furnitureStyleProfiles[style.id];
  const profile = { ...baseProfile, ...(design?.cabinetry ? { panel: ({ flat: 'plain', slatted: 'slat', shaker: 'frame', fluted: 'flute', lattice: 'lattice' } as Record<string, Profile['panel']>)[design.cabinetry] || baseProfile.panel } : {}) };
  const seating = design?.seating || ({ nordic: 'scandi', japanese: 'platform', wabisabi: 'organic', minimal: 'slim', industrial: 'pipe', luxury: 'tufted', cream: 'cloud', country: 'shaker', chinese: 'lattice', mediterranean: 'woven' } as Record<string, string>)[style.id];
  const tableDesign = design?.tables || ({ nordic: 'tapered', japanese: 'trestle', wabisabi: 'drum', minimal: 'metal', industrial: 'metal', luxury: 'pedestal', cream: 'drum', country: 'trestle', chinese: 'trestle', mediterranean: 'pedestal' } as Record<string, string>)[style.id];
  const w = f.w, d = f.d, kind: string = f.kind;
  let primaryTop: number | undefined;
  const roles: Record<FurnitureMaterialRole, [string, number, number]> = {
    wood: [style.wood, .63, 0], fabric: [style.fabric, .94, 0], accent: [style.accent, .65, 0], metal: [style.metal, .28, .72], stone: [style.floorFinish === 'marble' ? style.floor : style.wall, .3, .03], ceramic: ['#f8f5eb', .2, 0], glass: ['#cbdcd8', .08, .05], dark: ['#28312f', .25, .12], leaf: ['#718964', .9, 0], emissive: ['#ffe5b3', .4, 0],
  };
  const materials = {} as FurnitureMaterialSet;
  for (const role of Object.keys(roles) as FurnitureMaterialRole[]) {
    const external = options.materials?.[role];
    if (external) materials[role] = external;
    else {
      const [color, roughness, metalness] = roles[role];
      const material = role === 'glass' ? new THREE.MeshPhysicalMaterial({ color, roughness, metalness, transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color, roughness, metalness, ...(role === 'emissive' ? { emissive: color, emissiveIntensity: 1.8 } : {}) });
      materials[role] = material; ownedMaterials.add(material);
    }
  }
  if (config.color || (config.finish && config.finish !== 'style')) {
    const finishRole: FurnitureMaterialRole = config.finish === 'stone' ? 'stone' : config.finish === 'metal' ? 'metal' : config.finish === 'wood' ? 'wood' : 'fabric';
    for (const role of ['wood', 'fabric', 'accent'] as const) {
      const material = (config.finish === 'leather' && options.materials?.leather ? options.materials.leather : config.finish && config.finish !== 'style' ? materials[finishRole] : materials[role]).clone();
      if (config.color && 'color' in material) (material as THREE.MeshStandardMaterial).color.set(config.color);
      if (config.finish === 'leather' && 'roughness' in material) (material as THREE.MeshStandardMaterial).roughness = .43;
      materials[role] = material; ownedMaterials.add(material);
    }
  }
  const accentCloth = materials.fabric.clone();
  if ('color' in accentCloth) (accentCloth as THREE.MeshStandardMaterial).color.set(config.color || style.accent);
  ownedMaterials.add(accentCloth);
  const add = (geometry: THREE.BufferGeometry, role: FurnitureMaterialRole, x: number, y: number, z: number, name: string) => {
    geometries.add(geometry); const mesh = new THREE.Mesh(geometry, materials[role]); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name; group.add(mesh); return mesh;
  };
  const box = (bw: number, bh: number, bd: number, x: number, y: number, z: number, role: FurnitureMaterialRole = 'wood', radius = profile.radius, name: string = role) => {
    const rr = Math.min(radius, bw / 3, bh / 3, bd / 3);
    const mesh = add(rr > .005 ? new RoundedBoxGeometry(Math.max(.002, bw), Math.max(.002, bh), Math.max(.002, bd), 2, rr) : new THREE.BoxGeometry(Math.max(.002, bw), Math.max(.002, bh), Math.max(.002, bd)), role, x, y, z, name);
    if (role === 'accent' && /cushion|throw|rug-/.test(name)) mesh.material = accentCloth;
    return mesh;
  };
  const cyl = (top: number, bottom: number, height: number, x: number, y: number, z: number, role: FurnitureMaterialRole = 'wood', name: string = role, sides = 20) => add(new THREE.CylinderGeometry(Math.max(.001, top), Math.max(.001, bottom), Math.max(.001, height), sides), role, x, y, z, name);
  const ellipsoid = (rx: number, ry: number, rz: number, x: number, y: number, z: number, role: FurnitureMaterialRole = 'fabric', name: string = role) => { const m = add(new THREE.SphereGeometry(1, 20, 12), role, x, y, z, name); m.scale.set(rx, ry, rz); return m; };
  const tube = (points: THREE.Vector3[], radius: number, role: FurnitureMaterialRole, name: string, closed = false) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 5), radius, 7, closed), role, 0, 0, 0, name);
  const bar = (a: THREE.Vector3, b: THREE.Vector3, radius: number, role: FurnitureMaterialRole = 'metal', name = 'frame') => {
    const delta = b.clone().sub(a), center = a.clone().add(b).multiplyScalar(.5), mesh = cyl(radius, radius, delta.length(), center.x, center.y, center.z, role, name, 10); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  };
  const torus = (radius: number, thickness: number, x: number, y: number, z: number, role: FurnitureMaterialRole, name: string) => add(new THREE.TorusGeometry(radius, thickness, 8, 32), role, x, y, z, name);
  const leg = (x: number, z: number, height: number) => {
    const role = profile.leg === 'tube' || style.id === 'industrial' ? 'metal' : 'wood';
    if (profile.leg === 'turned') {
      const pts = [[0, 0], [.021, 0], [.027, height * .1], [.019, height * .2], [.035, height * .38], [.022, height * .55], [.033, height * .72], [.027, height], [0, height]].map(([r, y]) => new THREE.Vector2(r, y));
      add(new THREE.LatheGeometry(pts, 14), role, x, 0, z, 'turned-leg');
    } else if (profile.leg === 'taper') {
      const m = cyl(.027, .017, height, x, height / 2, z, role, 'tapered-leg', 12); m.rotation.z = -Math.sign(x) * .075; m.rotation.x = Math.sign(z) * .06;
    } else box(.035, height, .035, x, height / 2, z, role, .006, 'straight-leg');
  };
  const legs = (bw: number, bd: number, h: number) => {
    if (profile.leg === 'plinth') { box(bw * .8, h, bd * .74, 0, h / 2, 0, 'wood', .012, 'recessed-plinth'); return; }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(sx * Math.max(.02, bw / 2 - .09), sz * Math.max(.02, bd / 2 - .08), h);
    if (profile.leg === 'frame') for (const side of [-1, 1]) {
      const x = side * (bw / 2 - .09); box(.035, .035, bd * .8, x, .07, 0, style.id === 'industrial' ? 'metal' : 'wood', .004, 'frame-crossbar');
      if (style.id === 'industrial') bar(new THREE.Vector3(x, .06, -bd * .35), new THREE.Vector3(x, h * .85, bd * .35), .014, 'metal', 'steel-bracing');
    }
  };
  const knob = (x: number, y: number, z: number, horizontal = false) => {
    if (style.id === 'minimal' || style.id === 'japanese' || style.id === 'cream') { box(.09, .008, .012, x, y, z, 'dark', .002, 'recessed-finger-pull'); return; }
    if (style.id === 'country' || style.id === 'mediterranean') ellipsoid(.018, .018, .018, x, y, z + .008, 'metal', 'cabinet-knob');
    else box(horizontal ? .15 : .012, horizontal ? .012 : .16, .025, x, y, z, 'metal', .005, 'cabinet-handle');
  };
  const panel = (pw: number, ph: number, x: number, y: number, z: number, role: FurnitureMaterialRole = 'wood') => {
    box(pw, ph, .023, x, y, z, role, .008, 'door-panel');
    if (profile.panel === 'frame') {
      box(pw - .045, ph - .045, .014, x, y, z + .016, 'accent', .005, 'inset-panel'); box(pw - .09, ph - .09, .018, x, y, z + .028, role, .008, 'shaker-panel');
    } else if (profile.panel === 'flute' || profile.panel === 'slat') {
      const count = Math.min(18, Math.max(4, Math.round(pw / (profile.panel === 'flute' ? .035 : .08))));
      for (let i = 0; i < count; i++) box(pw / count * .56, ph - .04, .012, x - pw / 2 + (i + .5) * pw / count, y, z + .018, role, profile.panel === 'flute' ? .012 : .002, 'vertical-fluting');
    } else if (profile.panel === 'lattice') {
      for (let i = 1; i < 5; i++) box(.012, ph - .04, .012, x - pw / 2 + pw * i / 5, y, z + .018, role, .002, 'lattice-vertical');
      for (let i = 1; i < 4; i++) box(pw - .04, .012, .012, x, y - ph / 2 + ph * i / 4, z + .021, role, .002, 'lattice-horizontal');
    }
  };
  const cabinet = (bw: number, bd: number, h: number, open = false, drawers = false) => {
    const base = profile.leg === 'plinth' ? .05 : .12; legs(bw - .035, bd - .025, base);
    box(bw, .035, bd, 0, base, 0, 'wood', .005, 'cabinet-bottom'); box(bw, .045, bd, 0, h, 0, 'wood', .008, 'cabinet-top');
    for (const side of [-1, 1]) box(.03, h - base, bd, side * (bw / 2 - .015), (h + base) / 2, 0, 'wood', .003, 'cabinet-side');
    box(bw - .04, h - base, .025, 0, (h + base) / 2, -bd / 2 + .015, 'wood', .003, 'cabinet-back');
    if (open) {
      const shelves = Math.max(2, Math.round(h / .42));
      for (let i = 1; i < shelves; i++) box(bw - .04, .025, bd - .02, 0, base + (h - base) * i / shelves, 0, 'wood', .004, 'open-shelf');
      for (let row = 0; row < shelves; row++) for (let i = 0; i < 5; i++) { const bh = .18 + ((i + row) % 3) * .03; const book = box(.035 + (i % 2) * .015, bh, bd * .58, -bw / 2 + .12 + i * bw * .12, base + row * (h - base) / shelves + bh / 2, 0, i % 2 ? 'fabric' : 'accent', .003, 'book-spine'); if (i === 4) book.rotation.z = -.13; }
    } else if (drawers) {
      const count = Math.max(2, Math.round((h - base) / .22));
      for (let i = 0; i < count; i++) { const ph = (h - base) / count - .018, py = base + (i + .5) * (h - base) / count; panel(bw - .05, ph, 0, py, bd / 2); knob(0, py, bd / 2 + .029, true); }
    } else {
      const count = Math.max(1, Math.round(bw / .55));
      for (let i = 0; i < count; i++) { const pw = (bw - .04) / count - .014, px = -bw / 2 + .02 + (i + .5) * (bw - .04) / count; panel(pw, h - base - .045, px, (h + base) / 2, bd / 2); knob(px + pw * .32, (h + base) / 2, bd / 2 + .03); }
    }
  };
  const pillow = (bw: number, bh: number, bd: number, x: number, y: number, z: number, accent = false) => {
    const m = box(bw, bh, bd, x, y, z, accent ? 'accent' : 'fabric', profile.soft ? .07 : .025, 'loose-cushion'); m.rotation.z = Math.sign(x || 1) * -.1;
    return m;
  };
  const plant = (x: number, y: number, z: number, scale: number) => {
    cyl(scale * .26, scale * .2, scale * .38, x, y + scale * .19, z, 'accent', 'ceramic-planter'); cyl(scale * .24, scale * .24, .015, x, y + scale * .39, z, 'dark', 'pot-soil');
    for (let i = 0; i < 8; i++) { const a = i * 2.4, r = scale * (.09 + (i % 3) * .06), top = y + scale * (.75 + (i % 3) * .09); bar(new THREE.Vector3(x, y + scale * .36, z), new THREE.Vector3(x + Math.cos(a) * r, top, z + Math.sin(a) * r), scale * .009, 'leaf', 'plant-stem'); const leaf = ellipsoid(scale * .12, scale * .24, scale * .045, x + Math.cos(a) * r, top, z + Math.sin(a) * r, 'leaf', 'plant-leaf'); leaf.rotation.set(Math.sin(a) * .65, a, Math.cos(a) * .65); }
  };
  const monitor = (x: number, y: number, width: number, depth: number) => {
    box(width * .75, .025, .13, x, y + .025, -depth * .2, 'metal', .008, 'monitor-foot'); box(.035, .12, .04, x, y + .09, -depth * .24, 'metal', .004, 'monitor-stand'); box(width, width * .59, .035, x, y + .22 + width * .16, -depth * .25, 'dark', .015, 'monitor-frame'); box(width * .93, width * .51, .008, x, y + .22 + width * .16, -depth * .25 + .023, 'glass', .008, 'monitor-screen'); box(width * .72, .018, .12, x, y + .026, depth * .18, 'ceramic', .008, 'keyboard');
  };

  const sofa = (mode: 'straight' | 'sectional' | 'single' | 'ottoman') => {
    const cloud = seating === 'cloud' || seating === 'organic', platform = seating === 'platform', slim = seating === 'slim', frame = ['pipe', 'shaker', 'lattice', 'woven'].includes(seating);
    const legH = platform ? .12 : slim ? .21 : cloud ? .045 : .15, seatY = platform ? .34 : .43, arm = cloud ? Math.min(w * .16, .23) : slim ? .065 : Math.min(w * .13, .15);
    legs(w - .04, d - .05, legH); box(w - .04, cloud ? .25 : .14, d - .04, 0, legH + .09, 0, platform || frame ? 'wood' : 'fabric', cloud ? .12 : .02, 'sofa-base');
    if (mode === 'ottoman') { box(w, .23, d, 0, seatY, 0, 'fabric', cloud ? .1 : .045, 'ottoman-cushion'); if (seating === 'tufted') for (const x of [-w * .22, w * .22]) for (const z of [-d * .22, d * .22]) ellipsoid(.015, .008, .015, x, seatY + .117, z, 'accent', 'upholstery-button'); return; }
    const seatD = mode === 'sectional' ? d * .61 : d * .77, seats = mode === 'single' ? 1 : Math.max(2, Math.round(w / .85));
    for (let i = 0; i < seats; i++) {
      const sw = (w - 2 * arm - .03) / seats, x = -w / 2 + arm + (i + .5) * sw;
      box(sw - .018, cloud ? .24 : .16, seatD, x, seatY, d / 2 - seatD / 2 - .035, 'fabric', cloud ? .1 : .035, 'separate-seat-cushion');
      if (cloud) ellipsoid(sw * .53, .25, .15, x, seatY + .25, -d / 2 + .14, 'fabric', 'cloud-back');
      else { const back = box(sw - .012, slim ? .37 : .46, .17, x, seatY + .22, -d / 2 + .105, 'fabric', profile.soft ? .055 : .015, 'back-cushion'); back.rotation.x = -.08; }
      if (seating === 'tufted' || seating === 'pipe') for (let row = 0; row < 2; row++) for (let b = 0; b < 2; b++) ellipsoid(.012, .012, .006, x - sw * .2 + b * sw * .4, seatY + .12 + row * .17, -d / 2 + .197, 'accent', 'tufted-button');
    }
    if (mode === 'sectional') { const chaiseW = (w - 2 * arm) * .43, chaiseD = d * .6; box(chaiseW, .19, chaiseD, -w / 2 + arm + chaiseW / 2, seatY - .015, d / 2 - chaiseD / 2 - .025, 'fabric', cloud ? .1 : .035, 'chaise-longue'); }
    for (const side of [-1, 1]) {
      const x = side * (w / 2 - arm / 2);
      if (frame) {
        if (seating === 'pipe') { tube([new THREE.Vector3(x, .2, -d * .38), new THREE.Vector3(x, .68, -d * .38), new THREE.Vector3(x, .68, d * .38), new THREE.Vector3(x, .2, d * .38)], .018, 'metal', 'tubular-arm-frame'); box(arm * .9, .05, d * .73, x, .7, 0, 'wood', .012, 'arm-cap'); }
        else { box(arm * .65, .05, d * .83, x, .68, 0, 'wood', .015, 'wood-armrest'); for (let i = 0; i < (seating === 'lattice' ? 3 : 5); i++) box(.024, .33, .022, x, .48, -d * .3 + i * d * .6 / (seating === 'lattice' ? 2 : 4), 'wood', .006, 'arm-spindles'); }
      } else if (cloud) ellipsoid(arm * .53, .27, d * .45, x, .44, 0, 'fabric', 'rounded-upholstered-arm');
      else box(arm, .33, d * .91, x, .48, .01, platform ? 'wood' : 'fabric', slim ? .01 : .05, 'sofa-arm');
    }
    if (seating === 'lattice' || seating === 'woven') { for (let i = 0; i < 7; i++) box(.025, .4, .024, -w * .4 + i * w * .8 / 6, .57, -d / 2 + .025, 'wood', .003, 'exposed-back-spindles'); }
    if (seating === 'woven') for (let i = 0; i < 12; i++) box(w * .88, .008, .012, 0, .38 + i * .031, -d / 2 + .045, 'fabric', .003, 'woven-back-strand');
    if (seating === 'lattice') for (const y of [.43, .69]) box(w * .86, .026, .023, 0, y, -d / 2 + .045, 'wood', .003, 'lattice-back-crossbar');
    if (w > 1.4 && mode !== 'sectional') for (const side of [-1, 1]) { const p = pillow(Math.min(.34, w * .19), .3, .12, side * (w / 2 - arm - .17), .65, -d * .15, side > 0); p.rotation.x = -.18; }
  };
  const diningChair = (office = false, stool = false) => {
    const seatH = stool ? .74 : .45, seatW = w * .91, seatD = d * .8;
    if (office) {
      cyl(.055, .055, .36, 0, .24, 0, 'metal', 'gas-lift');
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4, x = Math.cos(a) * w * .39, z = Math.sin(a) * d * .39; bar(new THREE.Vector3(0, .1, 0), new THREE.Vector3(x, .06, z), .022, 'metal', 'five-star-base'); const wheel = cyl(.035, .035, .025, x, .035, z, 'dark', 'caster-wheel'); wheel.rotation.z = Math.PI / 2; }
    } else legs(w * .88, d * .82, seatH - .065);
    if (stool && profile.leg !== 'plinth') { const ring = torus(Math.min(w, d) * .32, .012, 0, .28, 0, 'metal', 'footrest-ring'); ring.rotation.x = Math.PI / 2; }
    box(seatW, .085, seatD, 0, seatH, d * .03, seating === 'lattice' ? 'wood' : 'fabric', profile.soft ? .055 : .012, 'chair-seat');
    if (stool) { box(seatW * .84, .22, .055, 0, seatH + .13, -d * .34, 'wood', .035, 'stool-back'); return; }
    const bh = office ? .58 : .43, bz = -d * .36;
    if (['shaker', 'lattice', 'woven'].includes(seating)) {
      for (const side of [-1, 1]) box(.035, bh, .035, side * w * .42, seatH + bh / 2, bz, 'wood', .008, 'chair-back-post');
      box(w * .9, .06, .05, 0, seatH + bh, bz, 'wood', .018, 'chair-top-rail');
      for (let i = 0; i < 5; i++) box(.018, bh * .83, .02, -w * .32 + i * w * .16, seatH + bh * .51, bz, 'wood', .004, 'spindle-back');
    } else { const back = box(w * .88, bh, .07, 0, seatH + bh * .5, bz, office ? 'dark' : 'fabric', profile.soft ? .06 : .018, 'chair-backrest'); back.rotation.x = -.08; if (office) for (let i = 0; i < 8; i++) box(w * .75, .005, .008, 0, seatH + .08 + i * .06, bz + .045, 'accent', .002, 'mesh-back-weave'); }
    if (office) for (const side of [-1, 1]) { box(.035, .2, .035, side * w * .43, seatH + .12, 0, 'metal', .008, 'arm-support'); box(.055, .035, d * .45, side * w * .43, seatH + .23, .01, 'dark', .016, 'office-armrest'); }
  };
  const tabletop = (height: number, round = false, coffee = false) => {
    const topRole = profile.stoneTop ? 'stone' : 'wood', thickness = style.id === 'cream' || style.id === 'wabisabi' ? .085 : .045;
    primaryTop = height + thickness / 2;
    if (round) { const top = cyl(.5, .5, thickness, 0, height, 0, topRole, 'round-tabletop', 48); top.scale.set(w, 1, d); }
    else box(w, thickness, d, 0, height, 0, topRole, profile.radius * 1.7, 'tabletop');
    const below = height - thickness / 2;
    if (tableDesign === 'drum') { const m = cyl(.5, .45, below, 0, below / 2, 0, 'wood', 'sculpted-drum-base', 32); m.scale.set(w * .59, 1, d * .62); }
    else if (tableDesign === 'pedestal') { const foot = cyl(Math.min(w, d) * .34, Math.min(w, d) * .38, .055, 0, .04, 0, 'metal', 'pedestal-foot', 36); if (style.id === 'mediterranean') foot.material = materials.stone; cyl(Math.min(w, d) * .11, Math.min(w, d) * .2, below - .05, 0, below / 2 + .025, 0, 'wood', 'pedestal-column'); }
    else if (tableDesign === 'trestle') { for (const side of [-1, 1]) { const x = side * w * (round ? .25 : .32); box(.08, below, d * (round ? .5 : .6), x, below / 2, 0, 'wood', .008, 'trestle-end'); box(.13, .05, d * (round ? .55 : .86), x, .05, 0, 'wood', .008, 'trestle-foot'); } box(w * .66, .055, .06, 0, below * .42, 0, 'wood', .006, 'trestle-stretcher'); }
    else if (tableDesign === 'metal' && style.id !== 'industrial') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.022, below, .022, sx * w * (round ? .29 : .42), below / 2, sz * d * (round ? .29 : .39), 'metal', .003, 'slim-metal-table-leg'); box(w * (round ? .6 : .86), .025, .025, 0, below - .035, -d * (round ? .29 : .39), 'metal', .003, 'metal-table-apron'); }
    else legs(w * (round ? .72 : .93), d * (round ? .72 : .93), below);
    if (style.id === 'mediterranean') { const rows = 4, cols = 5; for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) { const x = -w * .4 + col * w * .2, z = -d * .375 + row * d * .25; if (!round || (x / (w * .5)) ** 2 + (z / (d * .5)) ** 2 < .72) box(w * .18, .003, d * .21, x, height + thickness / 2 + .003, z, (row + col) % 2 ? 'ceramic' : 'accent', .002, 'table-mosaic-tile'); } }
    if (!coffee && w > .9) { cyl(.095, .07, .15, 0, height + thickness / 2 + .075, 0, 'ceramic', 'table-vase'); plant(0, height + thickness / 2 + .12, 0, .16); }
    else { box(w * .23, .025, d * .32, -w * .2, height + thickness / 2 + .018, 0, 'accent', .002, 'coffee-table-book'); cyl(.055, .043, .09, w * .23, height + thickness / 2 + .05, 0, 'ceramic', 'ceramic-cup'); }
  };
  const bed = (single = false, bunk = false) => {
    const baseH = profile.low ? .18 : .3, mattressY = baseH + .14;
    box(w, baseH, d, 0, baseH / 2 + .04, 0, 'wood', profile.soft ? .025 : .005, 'bed-platform');
    if (!profile.low) legs(w * .94, d * .94, .08);
    const mattress = (y: number) => { box(w - .075, .19, d - .12, 0, y, .02, 'ceramic', .055, 'mattress'); box(w - .06, .075, d * .61, 0, y + .12, d * .19, 'fabric', .035, 'duvet'); box(w - .06, .025, d * .18, 0, y + .16, d * .2, 'accent', .012, 'folded-bed-throw'); const count = single || bunk ? 1 : 2; for (let i = 0; i < count; i++) pillow((w - .16) / count - .025, .12, d * .18, count === 1 ? 0 : (i ? 1 : -1) * w * .23, y + .15, -d * .31); for (let i = 0; i < 6; i++) box(w - .11, .004, .008, 0, y + .16, d * .05 + i * d * .075, 'fabric', .002, 'duvet-stitch'); };
    mattress(mattressY);
    if (bunk) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.06, 1.99, .06, sx * (w / 2 - .03), .995, sz * (d / 2 - .03), 'wood', .008, 'bunk-post');
      box(w, .1, d, 0, 1.37, 0, 'wood', .008, 'upper-bunk-base'); mattress(1.51);
      for (const side of [-1, 1]) { box(.035, .045, d - .08, side * (w / 2 - .03), 1.97, 0, 'wood', .008, 'upper-guardrail'); box(.026, .025, d - .08, side * (w / 2 - .03), 1.8, 0, 'wood', .005, 'lower-guardrail'); }
      box(w - .07, .04, .035, 0, 1.97, -d / 2 + .03, 'wood', .006, 'bunk-head-rail');
      for (const x of [w * .07, w * .42]) box(.035, 1.5, .045, x, .75, d / 2 - .025, 'wood', .006, 'bunk-ladder-stringer');
      for (let i = 0; i < 6; i++) box(w * .35, .035, .055, w * .245, .18 + i * .23, d / 2 - .025, 'wood', .006, 'bunk-ladder-rung');
      return;
    }
    const headH = profile.low ? .66 : style.id === 'luxury' ? 1.28 : 1.05;
    box(w, headH, .09, 0, headH / 2, -d / 2 + .045, ['cloud', 'tufted', 'slim'].includes(seating) ? 'fabric' : 'wood', profile.soft ? .07 : .008, 'headboard');
    if (seating === 'tufted' || profile.panel === 'flute') for (let i = 0; i < Math.max(4, Math.round(w / .14)); i++) box(.06, headH - .1, .025, -w / 2 + .08 + i * (w - .16) / (Math.max(4, Math.round(w / .14)) - 1), headH / 2, -d / 2 + .105, 'fabric', .02, 'channel-tufted-headboard');
    if (seating === 'lattice' || seating === 'platform') for (let i = 1; i < 8; i++) box(.025, headH * .6, .025, -w / 2 + i * w / 8, headH * .65, -d / 2 + .105, 'wood', .003, 'headboard-slats');
  };

  switch (kind) {
    case 'sofa': case 'loveseat': sofa('straight'); break;
    case 'sectionalSofa': sofa('sectional'); break;
    case 'chair': case 'armchair': sofa('single'); break;
    case 'ottoman': sofa('ottoman'); break;
    case 'diningChair': diningChair(); break;
    case 'officeChair': diningChair(true); break;
    case 'barStool': diningChair(false, true); break;
    case 'table': tabletop(d < .75 ? .4 : .75); break;
    case 'roundTable': tabletop(.75, true); break;
    case 'coffeeTable': tabletop(.39, profile.soft, true); break;
    case 'sideTable': tabletop(.52, profile.pedestal, true); break;
    case 'bench': legs(w * .95, d * .9, .4); box(w, .08, d, 0, .44, 0, seating === 'platform' || seating === 'lattice' ? 'wood' : 'fabric', profile.radius, 'bench-seat'); if (style.id === 'industrial' || style.id === 'chinese') box(w * .8, .04, .04, 0, .18, 0, 'wood', .004, 'bench-stretcher'); break;
    case 'bed': bed(); break;
    case 'singleBed': bed(true); break;
    case 'bunkBed': bed(true, true); break;
    case 'crib': {
      legs(w - .04, d - .04, .12); box(w, .08, d, 0, .3, 0, 'wood', .012, 'crib-base'); box(w - .08, .09, d - .08, 0, .39, 0, 'ceramic', .035, 'crib-mattress');
      for (const side of [-1, 1]) { box(w, .045, .035, 0, 1, side * (d / 2 - .02), 'wood', .014, 'crib-top-rail'); for (let i = 0; i < 11; i++) box(.018, .66, .018, -w * .46 + i * w * .092, .67, side * (d / 2 - .02), 'wood', .005, 'crib-safety-spindle'); box(.035, .69, d, side * (w / 2 - .02), .66, 0, 'wood', .01, 'crib-end-panel'); }
      break;
    }
    case 'nightstand': cabinet(w, d * .92, .55, false, true); break;
    case 'dresser': cabinet(w, d * .93, .9, false, true); break;
    case 'wardrobe': cabinet(w, d * .94, Math.min(options.roomHeight - .1, 2.3)); break;
    case 'bookshelf': cabinet(w, d * .95, 1.95, true); break;
    case 'shoeCabinet': cabinet(w, d * .93, 1.1); break;
    case 'sideboard': cabinet(w, d * .94, .85); plant(w * .3, .88, 0, .25); break;
    case 'tv': {
      cabinet(w, d * .9, .42); const tw = w * .79, th = tw * .56; box(tw, th, .045, 0, .56 + th / 2, -d * .1, 'dark', .018, 'television-bezel'); box(tw - .035, th - .035, .008, 0, .56 + th / 2, -d * .1 + .029, 'glass', .01, 'television-screen'); for (const side of [-1, 1]) bar(new THREE.Vector3(side * tw * .27, .59, -d * .1), new THREE.Vector3(side * tw * .32, .45, d * .17), .012, 'metal', 'tv-feet'); box(w * .35, .055, d * .17, 0, .47, d * .26, 'dark', .018, 'soundbar'); break;
    }
    case 'desk': case 'doubleDesk': {
      primaryTop = .74 + .055 / 2;
      legs(w * .95, d * .93, .71); box(w, .055, d, 0, .74, 0, 'wood', profile.radius, 'desk-top');
      const count = kind === 'doubleDesk' ? 2 : 1; for (let i = 0; i < count; i++) monitor(count === 1 ? 0 : (i ? 1 : -1) * w * .25, .77, Math.min(.57, w / count * .65), d);
      box(w * .2, .12, d * .72, -w * .34, .64, -.015, 'wood', .012, 'desk-drawer'); knob(-w * .34, .64, d * .36, true); plant(w * .41, .78, -d * .25, .2); break;
    }
    case 'kitchen': case 'kitchenIsland': {
      primaryTop = .9 + .05 / 2;
      const island = kind === 'kitchenIsland'; cabinet(w, d * .91, .86); box(w, .05, d, 0, .9, 0, 'stone', .012, 'countertop');
      if (island) { for (let i = 0; i < 3; i++) box(w * .14, .004, d * .31, -w * .29 + i * w * .29, .929, d * .15, 'ceramic', .03, 'island-place-setting'); }
      else {
        const sinkW = Math.min(.55, w * .24), sinkD = d * .55, sx = -w * .24; box(sinkW, .008, sinkD, sx, .93, 0, 'metal', .035, 'sink-rim'); box(sinkW * .85, .012, sinkD * .82, sx, .937, 0, 'dark', .03, 'sink-basin');
        tube([new THREE.Vector3(sx, .95, -sinkD * .35), new THREE.Vector3(sx, 1.17, -sinkD * .35), new THREE.Vector3(sx, 1.2, -.02), new THREE.Vector3(sx, 1.11, .02)], .013, 'metal', 'gooseneck-faucet');
        if (w > 1.3) { box(w * .25, .012, d * .67, w * .26, .936, 0, 'dark', .018, 'induction-cooktop'); for (const x of [w * .21, w * .31]) { const ring = torus(d * .13, .007, x, .948, 0, 'metal', 'burner-ring'); ring.rotation.x = Math.PI / 2; } }
      }
      break;
    }
    case 'fridge': {
      box(w, 1.88, d * .96, 0, .94, 0, 'metal', .025, 'refrigerator-body'); box(w * .96, .51, .035, 0, 1.59, d * .49, 'ceramic', .02, 'freezer-door'); box(w * .96, 1.29, .035, 0, .665, d * .49, 'ceramic', .02, 'fridge-door'); for (const y of [1.54, 1.07]) box(.025, .3, .035, w * .34, y, d * .52, 'metal', .009, 'appliance-handle'); box(w * .25, .1, .008, -w * .2, 1.06, d * .516, 'dark', .008, 'fridge-display'); break;
    }
    case 'oven': case 'dishwasher': {
      const oven = kind === 'oven'; box(w, .86, d * .95, 0, .43, 0, 'metal', .012, 'appliance-body'); box(w * .94, .65, .025, 0, .37, d * .49, oven ? 'dark' : 'ceramic', .01, 'appliance-door'); if (oven) box(w * .72, .39, .012, 0, .36, d * .51, 'glass', .012, 'oven-window'); box(w * .72, .02, .035, 0, .7, d * .52, 'metal', .008, 'appliance-pull');
      for (let i = 0; i < (oven ? 3 : 4); i++) { const knobMesh = cyl(.025, .025, .016, -w * .26 + i * w * .18, .79, d * .5, oven ? 'metal' : 'dark', 'appliance-controls', 14); knobMesh.rotation.x = Math.PI / 2; } break;
    }
    case 'toilet': {
      ellipsoid(w * .29, .22, d * .3, 0, .25, d * .05, 'ceramic', 'toilet-pedestal'); ellipsoid(w * .45, .12, d * .35, 0, .43, d * .08, 'ceramic', 'toilet-bowl'); const seat = torus(w * .33, .03, 0, .52, d * .08, 'ceramic', 'toilet-seat-ring'); seat.rotation.x = Math.PI / 2; seat.scale.y = d / w * .87; box(w * .85, .62, d * .21, 0, .37, -d * .37, 'ceramic', .05, 'toilet-cistern'); box(.09, .012, .045, 0, .69, -d * .37, 'metal', .008, 'flush-button'); break;
    }
    case 'shower': {
      box(w, .05, d, 0, .025, 0, 'stone', .015, 'shower-tray');
      const h = Math.min(options.roomHeight - .15, 2.05); for (const x of [-w / 2 + .018, w / 2 - .018]) box(.025, h, .025, x, h / 2, d / 2 - .015, 'metal', .003, 'shower-frame'); box(w, h, .012, 0, h / 2, d / 2 - .015, 'glass', .002, 'shower-glass-door'); box(.012, h, d, -w / 2 + .015, h / 2, 0, 'glass', .002, 'shower-glass-side'); box(w, .025, .025, 0, h, d / 2 - .015, 'metal', .003, 'shower-top-rail'); box(.012, .23, .035, w * .23, h * .53, d / 2 - .035, 'metal', .005, 'shower-pull'); bar(new THREE.Vector3(w * .27, .9, -d * .42), new THREE.Vector3(w * .27, 1.88, -d * .42), .014, 'metal', 'shower-riser'); cyl(.11, .11, .025, w * .27, 1.9, -d * .27, 'metal', 'rain-shower-head'); tube([new THREE.Vector3(w * .27, 1.8, -d * .42), new THREE.Vector3(w * .27, .8, -d * .26), new THREE.Vector3(w * .2, 1.2, -d * .4)], .008, 'metal', 'hand-shower-hose'); break;
    }
    case 'vanity': {
      primaryTop = .81 + .045 / 2;
      cabinet(w, d * .9, .77, false, true); box(w, .045, d, 0, .81, 0, 'stone', .018, 'vanity-counter'); const bowl = ellipsoid(w * .32, .11, d * .34, 0, .9, 0, 'ceramic', 'wash-basin'); bowl.scale.y *= .85; ellipsoid(w * .27, .009, d * .28, 0, 1, .005, 'glass', 'basin-inner-shadow'); tube([new THREE.Vector3(0, .85, -d * .33), new THREE.Vector3(0, 1.15, -d * .33), new THREE.Vector3(0, 1.13, -d * .07)], .013, 'metal', 'vanity-faucet'); box(w * .84, .72, .035, 0, 1.55, -d * .46, 'metal', .04, 'mirror-frame'); box(w * .78, .66, .008, 0, 1.55, -d * .435, 'glass', .04, 'mirror'); break;
    }
    case 'bathtub': {
      box(w, .51, d, 0, .27, 0, 'ceramic', Math.min(w, d) * .2, 'bathtub-shell'); box(w * .85, .035, d * .74, 0, .535, 0, 'glass', .1, 'bathtub-recess'); const rim = new THREE.Shape(); rim.absellipse(0, 0, w * .48, d * .47, 0, Math.PI * 2, false, 0); const hole = new THREE.Path(); hole.absellipse(0, 0, w * .4, d * .37, 0, Math.PI * 2, true, 0); rim.holes.push(hole); const lip = add(new THREE.ExtrudeGeometry(rim, { depth: .035, bevelEnabled: false, curveSegments: 28 }), 'ceramic', 0, .53, 0, 'bathtub-open-rim'); lip.rotation.x = -Math.PI / 2; tube([new THREE.Vector3(w * .35, .55, -d * .35), new THREE.Vector3(w * .35, .85, -d * .35), new THREE.Vector3(w * .23, .85, -d * .26)], .015, 'metal', 'bath-spout'); break;
    }
    case 'washingMachine': {
      box(w, .85, d * .97, 0, .425, 0, 'ceramic', .02, 'washer-body'); box(w * .94, .13, .025, 0, .77, d * .49, 'metal', .008, 'washer-control-panel'); const rim = torus(w * .31, .025, 0, .4, d * .5, 'metal', 'washer-door-rim'); rim.scale.y = 1; const door = cyl(w * .28, w * .28, .018, 0, .4, d * .51, 'glass', 'washer-glass-porthole', 36); door.rotation.x = Math.PI / 2; const drum = cyl(w * .24, w * .24, .012, 0, .4, d * .5, 'dark', 'washer-drum', 32); drum.rotation.x = Math.PI / 2; const knobMesh = cyl(.035, .035, .02, w * .25, .77, d * .51, 'metal', 'washer-selector'); knobMesh.rotation.x = Math.PI / 2; box(w * .27, .04, .01, -w * .21, .77, d * .51, 'dark', .005, 'washer-display'); break;
    }
    case 'plant': plant(0, 0, 0, Math.min(w, d) * 1.35); break;
    case 'pendant': {
      const top = Math.max(1.8, options.roomHeight - .08), lighting = design?.lighting || (style.id === 'industrial' ? 'cage' : style.id === 'japanese' || style.id === 'chinese' ? 'paper' : profile.soft ? 'globe' : 'dome'), radius = Math.min(w, d) * .43;
      cyl(.045, .045, .045, 0, top, 0, 'metal', 'ceiling-canopy'); bar(new THREE.Vector3(0, top - .02, 0), new THREE.Vector3(0, top - .75, 0), .006, 'dark', 'pendant-cord');
      const shadeStart = group.children.length;
      const sy = top - .85;
      if (lighting === 'paper' || lighting === 'globe') { ellipsoid(radius, radius * .85, radius, 0, sy, 0, lighting === 'paper' ? 'fabric' : 'ceramic', 'pendant-globe'); if (lighting === 'paper') for (let i = 1; i < 9; i++) { const py = -radius * .75 + i * radius * 1.5 / 9, r = radius * Math.sqrt(Math.max(0, 1 - (py / (radius * .85)) ** 2)), ring = torus(r, .003, 0, sy + py, 0, 'accent', 'paper-lantern-rib'); ring.rotation.x = Math.PI / 2; } }
      else if (lighting === 'cage') { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; tube([new THREE.Vector3(0, sy + radius, 0), new THREE.Vector3(Math.cos(a) * radius, sy + radius * .3, Math.sin(a) * radius), new THREE.Vector3(Math.cos(a) * radius, sy - radius * .6, Math.sin(a) * radius)], .008, 'metal', 'cage-shade-rib'); } const ring = torus(radius, .009, 0, sy - radius * .6, 0, 'metal', 'cage-bottom-ring'); ring.rotation.x = Math.PI / 2; }
      else { const shade = add(new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', 0, sy, 0, 'dome-shade'); shade.material = materials.accent; }
      ellipsoid(.045, .055, .045, 0, sy - radius * .15, 0, 'emissive', 'lamp-bulb');
      const desiredBodyHeight = config.h ?? (catalog as Record<string, { h?: number }>)[kind]?.h;
      if (desiredBodyHeight) {
        group.updateMatrixWorld(true); const shadeBounds = new THREE.Box3(); group.children.slice(shadeStart).forEach(child => shadeBounds.union(new THREE.Box3().setFromObject(child))); const actual = shadeBounds.max.y - shadeBounds.min.y, factor = desiredBodyHeight / Math.max(.01, actual);
        for (const child of group.children.slice(shadeStart)) { child.position.y = sy + (child.position.y - sy) * factor; child.scale.y *= factor; }
      }
      break;
    }
    case 'floorLamp': {
      const radius = Math.min(w, d) * .39; cyl(radius, radius, .035, 0, .025, 0, 'metal', 'floor-lamp-base', 32); bar(new THREE.Vector3(0, .04, 0), new THREE.Vector3(0, 1.45, 0), .013, 'metal', 'floor-lamp-stem'); const lighting = design?.lighting || 'dome';
      if (lighting === 'paper' || lighting === 'globe') ellipsoid(radius, radius * .9, radius, 0, 1.5, 0, 'fabric', 'floor-lamp-globe');
      else cyl(radius * .68, radius, .32, 0, 1.5, 0, lighting === 'cage' ? 'metal' : 'fabric', 'floor-lamp-shade', 32); ellipsoid(.04, .045, .04, 0, 1.39, 0, 'emissive', 'lamp-bulb'); break;
    }
    case 'rug': {
      box(w, .016, d, 0, .012, 0, 'fabric', profile.soft ? .08 : .005, 'rug-base'); const pattern = design?.rug || (style.id === 'mediterranean' || style.id === 'chinese' ? 'pattern' : 'woven');
      if (pattern === 'pattern') { for (let i = 0; i < 3; i++) { const rw = w * (.9 - i * .18), rd = d * (.9 - i * .18); box(rw, .003, .018, 0, .022, -rd / 2, 'accent', .002, 'rug-border'); box(rw, .003, .018, 0, .022, rd / 2, 'accent', .002, 'rug-border'); box(.018, .003, rd, -rw / 2, .022, 0, 'accent', .002, 'rug-border'); box(.018, .003, rd, rw / 2, .022, 0, 'accent', .002, 'rug-border'); } }
      else if (pattern === 'woven') for (let i = 0; i < 16; i++) box(w * .97, .002, .009, 0, .022, -d * .45 + i * d * .9 / 15, i % 3 ? 'fabric' : 'accent', .002, 'woven-rug-stripe');
      for (const side of [-1, 1]) for (let i = 0; i < 18; i++) box(.008, .004, d * .035, -w * .46 + i * w * .92 / 17, .017, side * d * .48, 'fabric', .002, 'rug-fringe'); break;
    }
    case 'curtain': {
      const h = Math.min(options.roomHeight - .1, 2.5), folds = Math.max(10, Math.round(w / .11)); box(w, .04, d * .42, 0, h, 0, 'metal', .008, 'curtain-track');
      for (let i = 0; i < folds; i++) { const x = -w / 2 + (i + .5) * w / folds, front = i % 2 ? .08 : -.08; box(w / folds * 1.1, h - .08, Math.max(.02, d * .45), x, h / 2, d * front, 'fabric', .025, 'curtain-fold'); } break;
    }
    case 'screen': {
      const panels = 3, pw = w / panels, h = 1.8;
      for (let i = 0; i < panels; i++) { const px = -w / 2 + (i + .5) * pw, pz = (i % 2 ? 1 : -1) * d * .16; box(pw - .025, h, .035, px, h / 2, pz, 'wood', .008, 'screen-frame'); box(pw - .085, h - .13, .012, px, h / 2, pz + .024, seating === 'lattice' || seating === 'platform' ? 'ceramic' : 'fabric', .003, 'screen-infill'); for (let row = 1; row < (seating === 'lattice' ? 7 : 4); row++) box(pw - .065, .018, .018, px, row * h / (seating === 'lattice' ? 7 : 4), pz + .037, 'wood', .003, 'screen-grid'); if (seating === 'lattice' || seating === 'platform') for (const side of [-1, 1]) box(.014, h - .1, .018, px + side * pw * .23, h / 2, pz + .04, 'wood', .003, 'screen-grid'); }
      break;
    }
    default: cabinet(w, d * .92, .8); break;
  }

  group.userData.furnitureKind = kind; group.userData.style = style.id; group.userData.profile = profile;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group, true), size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  for (const child of group.children) { child.position.x -= center.x; child.position.z -= center.z; if (kind !== 'pendant') child.position.y -= bounds.min.y; }
  const presetHeight = (catalog as Record<string, { h?: number }>)[kind]?.h;
  const requestedHeight = config.h ?? presetHeight;
  const lowFactor = profile.low && ['sofa', 'loveseat', 'sectionalSofa', 'armchair', 'chair', 'ottoman', 'bed', 'singleBed', 'table', 'coffeeTable', 'sideTable', 'bench'].includes(kind) && config.h === undefined ? .78 : 1;
  const scaleY = kind === 'pendant' ? 1 : requestedHeight ? requestedHeight * lowFactor / Math.max(.001, primaryTop === undefined ? size.y : primaryTop - bounds.min.y) : lowFactor;
  group.scale.set(Math.min(1, w / Math.max(.001, size.x)), scaleY, Math.min(1, d / Math.max(.001, size.z)));
  // Merge opaque static parts by material to keep large room scenes responsive.
  if (options.mergeParts !== false) {
    group.updateMatrixWorld(true); const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(), parts: string[] = [];
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || child.material.transparent) continue;
      parts.push(child.name); const baked = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix); geometries.add(baked); const bucket = buckets.get(child.material) || []; bucket.push(baked); buckets.set(child.material, bucket); group.remove(child);
    }
    for (const [material, parts] of buckets) { const geometry = mergeGeometries(parts, false); if (!geometry) { for (const part of parts) { const mesh = new THREE.Mesh(part, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); } continue; } geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
    group.userData.parts = parts;
  }
  let disposed = false;
  return { group, dispose: () => { if (disposed) return; disposed = true; geometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose()); } };
}
