import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildFurnitureMesh } from './furnitureMeshes';
import { catalog } from './furnitureCatalog';
import type { FurnitureKind } from './furnitureCatalog';
import { interiorStyles } from './interiorStyles';
import type { Furniture } from './model';

const item = (kind: FurnitureKind): Furniture => ({ id: kind, kind, x: 0, y: 0, w: catalog[kind].w, d: catalog[kind].d, rotation: 0 });

describe('offline furniture geometry', () => {
  it('builds every library kind with finite geometry inside its editable footprint and declared height', () => {
    for (const kind of Object.keys(catalog) as FurnitureKind[]) {
      const f = item(kind), built = buildFurnitureMesh(f, interiorStyles[0], { cutaway: true, roomHeight: 2.8, mergeParts: false });
      const bounds = new THREE.Box3().setFromObject(built.group, true), size = bounds.getSize(new THREE.Vector3());
      expect(size.x, kind).toBeGreaterThan(0); expect(size.z, kind).toBeGreaterThan(0); expect(size.y, kind).toBeGreaterThan(0);
      expect(size.x, kind).toBeLessThanOrEqual(f.w + .00001); expect(size.z, kind).toBeLessThanOrEqual(f.d + .00001);
      expect(Math.abs(bounds.min.x + bounds.max.x), kind).toBeLessThan(.00001); expect(Math.abs(bounds.min.z + bounds.max.z), kind).toBeLessThan(.00001);
      const primaryNames: Partial<Record<FurnitureKind, string>> = { table: 'tabletop', roundTable: 'round-tabletop', coffeeTable: 'round-tabletop', sideTable: 'tabletop', desk: 'desk-top', doubleDesk: 'desk-top', kitchen: 'countertop', kitchenIsland: 'countertop', vanity: 'vanity-counter' };
      if (primaryNames[kind]) { const mainPart = built.group.getObjectByName(primaryNames[kind]!); expect(mainPart, kind).toBeDefined(); expect(new THREE.Box3().setFromObject(mainPart!, true).max.y, kind).toBeCloseTo(catalog[kind].h, 4); }
      else if (kind !== 'pendant') { expect(size.y, kind).toBeCloseTo(catalog[kind].h, 4); expect(bounds.min.y, kind).toBeCloseTo(0, 5); }
      else { expect(bounds.max.y, kind).toBeLessThan(2.8); expect(bounds.min.y, kind).toBeGreaterThan(1.2); }
      let vertices = 0;
      built.group.traverse(child => { if (child instanceof THREE.Mesh) { const p = child.geometry.getAttribute('position'); vertices += p.count; expect(Array.from(p.array).every(Number.isFinite), kind).toBe(true); } });
      expect(vertices, kind).toBeGreaterThan(100); built.dispose();
    }
  });

  it('keeps the wash basin shallow and round-table supports below the circular top', () => {
    const vanity = buildFurnitureMesh(item('vanity'), interiorStyles[0], { cutaway: false, roomHeight: 2.8, mergeParts: false });
    const basin = vanity.group.getObjectByName('wash-basin')!;
    expect(new THREE.Box3().setFromObject(basin, true).getSize(new THREE.Vector3()).y).toBeLessThan(.25);
    vanity.dispose();
    for (const style of interiorStyles) {
      const f = item('roundTable'), built = buildFurnitureMesh(f, style, { cutaway: false, roomHeight: 2.8, mergeParts: false });
      built.group.updateMatrixWorld(true);
      built.group.traverse(child => {
        if (!(child instanceof THREE.Mesh) || !/leg|trestle|apron|crossbar|bracing/.test(child.name)) return;
        const positions = child.geometry.getAttribute('position'), point = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
          expect((point.x / (f.w / 2)) ** 2 + (point.z / (f.d / 2)) ** 2, `${style.id} ${child.name}`).toBeLessThanOrEqual(1.001);
        }
      });
      built.dispose();
    }
  });

  it('changes actual sofa geometry for all ten styles while preserving the furniture footprint', () => {
    const signatures = new Set<number>();
    for (const style of interiorStyles) {
      const built = buildFurnitureMesh(item('sofa'), style, { cutaway: true, roomHeight: 2.8, mergeParts: false });
      built.group.updateMatrixWorld(true); let hash = 2166136261;
      built.group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const p = child.geometry.getAttribute('position'), v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(child.matrixWorld); for (const n of [v.x, v.y, v.z]) { hash ^= Math.round(n * 10000); hash = Math.imul(hash, 16777619); } }
      });
      signatures.add(hash >>> 0); built.dispose();
    }
    expect(signatures.size).toBe(10);
  });

  it('keeps recognisable functional parts and reduces opaque draw calls when merging', () => {
    const required: Partial<Record<FurnitureKind, string>> = { bunkBed: 'bunk-ladder-rung', doubleDesk: 'monitor-screen', officeChair: 'caster-wheel', kitchen: 'sink-basin', washingMachine: 'washer-glass-porthole', crib: 'crib-safety-spindle', bookshelf: 'book-spine', shower: 'hand-shower-hose' };
    for (const [kind, part] of Object.entries(required)) {
      const built = buildFurnitureMesh(item(kind as FurnitureKind), interiorStyles[0], { cutaway: true, roomHeight: 2.8 });
      const parts = [...built.group.userData.parts, ...built.group.children.map(child => child.name)];
      expect(parts, kind).toContain(part); expect(built.group.children.length, kind).toBeLessThan(parts.length); built.dispose();
    }
  });

  it('applies custom overall height, colour and finish without mutating or disposing shared materials', () => {
    const wood = new THREE.MeshStandardMaterial({ color: '#81572e', roughness: .4 }), fabric = new THREE.MeshStandardMaterial({ color: '#eee4d1', roughness: .95 });
    const woodDispose = vi.spyOn(wood, 'dispose'), fabricDispose = vi.spyOn(fabric, 'dispose');
    const f = { ...item('armchair'), h: 1.14, color: '#537c85', finish: 'wood' as const };
    const built = buildFurnitureMesh(f, interiorStyles[0], { cutaway: false, roomHeight: 2.8, materials: { wood, fabric } });
    expect(new THREE.Box3().setFromObject(built.group, true).getSize(new THREE.Vector3()).y).toBeCloseTo(1.14, 4);
    expect(wood.color.getHexString()).toBe('81572e'); expect(fabric.color.getHexString()).toBe('eee4d1');
    let overridden = false, geometryDisposeCount = 0;
    built.group.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.addEventListener('dispose', () => { geometryDisposeCount++; }); const material = child.material as THREE.MeshStandardMaterial; if (material.color?.getHexString() === '537c85') { overridden = true; expect(material.roughness).toBe(.4); } } });
    expect(overridden).toBe(true); built.dispose(); expect(geometryDisposeCount).toBeGreaterThan(0); const disposedOnce = geometryDisposeCount; built.dispose(); expect(geometryDisposeCount).toBe(disposedOnce); expect(woodDispose).not.toHaveBeenCalled(); expect(fabricDispose).not.toHaveBeenCalled(); wood.dispose(); fabric.dispose();
  });

  it('uses the dedicated leather texture for a leather finish and leaves the shared material intact', () => {
    const texture = new THREE.Texture(), normal = new THREE.Texture(), leather = new THREE.MeshStandardMaterial({ color: '#975e3c', map: texture, normalMap: normal, roughness: .43 });
    const dispose = vi.spyOn(leather, 'dispose'), built = buildFurnitureMesh({ ...item('sofa'), finish: 'leather' }, interiorStyles[0], { cutaway: true, roomHeight: 2.8, materials: { leather } });
    let leatherParts = 0;
    built.group.traverse(child => { if (child instanceof THREE.Mesh) { const material = child.material as THREE.MeshStandardMaterial; if (material.normalMap === normal) { leatherParts++; expect(material.map).toBe(texture); expect(material.roughness).toBe(.43); expect(material).not.toBe(leather); } } });
    expect(leatherParts).toBeGreaterThan(0); built.dispose(); expect(dispose).not.toHaveBeenCalled(); leather.dispose(); texture.dispose(); normal.dispose();
  });
});
