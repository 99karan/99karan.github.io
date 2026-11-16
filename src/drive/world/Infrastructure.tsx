import { useMemo } from 'react';
import * as THREE from 'three';
import { MARINA, RAMPS, ROADS, RUNWAY, terrainAt, ZONES, type Ramp } from './map';
import { dock, helipads } from './placements';

/* -------------------------------------------------------------- textures */

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function asphalt(ctx: CanvasRenderingContext2D, w: number, h: number, base = '#3b3e43') {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

const roadTexture = () =>
  canvas(128, 512, (ctx) => {
    asphalt(ctx, 128, 512);
    ctx.fillStyle = 'rgba(240,240,235,0.9)';
    ctx.fillRect(6, 0, 5, 512);
    ctx.fillRect(117, 0, 5, 512);
    ctx.fillStyle = '#e8b93a';
    for (let y = 0; y < 512; y += 128) ctx.fillRect(61, y + 20, 6, 70);
  });

const runwayTexture = () =>
  canvas(
    256,
    2048,
    (ctx) => {
      asphalt(ctx, 256, 2048, '#33363b');
      ctx.fillStyle = '#f2f2ee';
      ctx.fillRect(8, 0, 5, 2048);
      ctx.fillRect(243, 0, 5, 2048);
      // threshold piano keys + numbers at both ends
      for (const end of [0, 1]) {
        ctx.save();
        if (end) {
          ctx.translate(256, 2048);
          ctx.rotate(Math.PI);
        }
        for (let i = 0; i < 8; i++) ctx.fillRect(22 + i * 28, 14, 16, 90);
        ctx.font = '700 82px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(end ? '36' : '18', 128, 200);
        ctx.fillRect(40, 300, 40, 70);
        ctx.fillRect(176, 300, 40, 70);
        ctx.restore();
      }
      for (let y = 260; y < 1790; y += 90) ctx.fillRect(124, y, 8, 50);
    },
    false,
  );

const concreteTexture = () =>
  canvas(512, 512, (ctx) => {
    ctx.fillStyle = '#b7b3ab';
    ctx.fillRect(0, 0, 512, 512);
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(80,80,80,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  });

const chevronTexture = () =>
  canvas(256, 256, (ctx) => {
    ctx.fillStyle = '#f2b51d';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#16181c';
    for (let i = -2; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 64);
      ctx.lineTo(128, i * 64 + 64);
      ctx.lineTo(256, i * 64);
      ctx.lineTo(256, i * 64 + 26);
      ctx.lineTo(128, i * 64 + 90);
      ctx.lineTo(0, i * 64 + 26);
      ctx.closePath();
      ctx.fill();
    }
  });

const planksTexture = () =>
  canvas(256, 256, (ctx) => {
    for (let i = 0; i < 8; i++) {
      const v = 120 + Math.random() * 40;
      ctx.fillStyle = `rgb(${v + 30}, ${v}, ${v - 40})`;
      ctx.fillRect(0, i * 32, 256, 30);
      ctx.fillStyle = 'rgba(40,25,10,0.6)';
      ctx.fillRect(0, i * 32 + 30, 256, 2);
    }
  });

const padTexture = () =>
  canvas(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#2f3237';
      ctx.beginPath();
      ctx.arc(256, 256, 256, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f2b51d';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(256, 256, 220, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f2f2ee';
      ctx.font = '700 300px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', 256, 272);
    },
    false,
  );

/* ----------------------------------------------------------------- roads */

function roadGeometry(points: [number, number][], width: number, closed: boolean, lift: number) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    'centripetal',
  );
  const length = curve.getLength();
  const n = Math.max(8, Math.round(length / 2));
  const pts = curve.getSpacedPoints(n);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let dist = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const tl = Math.hypot(tx, tz) || 1;
    const sx = -tz / tl;
    const sz = tx / tl;
    if (i > 0) dist += p.distanceTo(prev);
    for (const s of [-1, 1]) {
      const x = p.x + sx * (width / 2) * s;
      const z = p.z + sz * (width / 2) * s;
      // Sample across the road so it never dips into the hillside.
      const y = Math.max(terrainAt(x, z), terrainAt(p.x, p.z)) + lift;
      pos.push(x, y, z);
      uv.push(s < 0 ? 0 : 1, dist / 16);
    }
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Roads() {
  const { meshes, material } = useMemo(() => {
    const map = roadTexture();
    const mat = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const geos = ROADS.map((r, i) => roadGeometry(r.points, r.width, !!r.closed, 0.06 + i * 0.006));
    return { meshes: geos, material: mat };
  }, []);
  return (
    <group>
      {meshes.map((g, i) => (
        <mesh key={i} geometry={g} material={material} receiveShadow />
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- runway */

export function Runway() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }), []);
  const apron = useMemo(() => {
    const t = concreteTexture();
    t.repeat.set(6, 8);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[RUNWAY.x, RUNWAY.height + 0.05, RUNWAY.z]} material={material} receiveShadow>
        <planeGeometry args={[RUNWAY.halfW * 2, RUNWAY.halfL * 2]} />
      </mesh>
      {/* apron in front of the hangar */}
      <mesh rotation-x={-Math.PI / 2} position={[ZONES.hangar.x + 8, RUNWAY.height + 0.03, ZONES.hangar.z]} material={apron} receiveShadow>
        <planeGeometry args={[40, 46]} />
      </mesh>
      {/* edge lights */}
      <EdgeLights />
    </group>
  );
}

function EdgeLights() {
  const { geometry, positions } = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
    const p: [number, number, number][] = [];
    for (let z = -RUNWAY.halfL; z <= RUNWAY.halfL; z += 18) {
      for (const s of [-1, 1]) p.push([RUNWAY.x + s * (RUNWAY.halfW + 1.2), RUNWAY.height + 0.2, RUNWAY.z + z]);
    }
    return { geometry: g, positions: p };
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb347', emissiveIntensity: 2.5 }), []);
  return (
    <instancedMesh
      args={[geometry, mat, positions.length]}
      ref={(m) => {
        if (!m) return;
        const o = new THREE.Object3D();
        positions.forEach((p, i) => {
          o.position.set(...p);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      }}
    />
  );
}

/* ----------------------------------------------------------------- plaza */

export function Plaza() {
  const material = useMemo(() => {
    const t = concreteTexture();
    t.repeat.set(10, 10);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
  }, []);
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: '#66e0c0', emissive: '#66e0c0', emissiveIntensity: 0.6, roughness: 0.5 }), []);
  return (
    <group position={[ZONES.plaza.x, 2.6, ZONES.plaza.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.04} material={material} receiveShadow>
        <circleGeometry args={[40, 72]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.07} material={ring}>
        <ringGeometry args={[39.2, 40, 96]} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------- ramps */

function rampGeometry(r: Ramp) {
  const w = r.width / 2;
  const l = r.length / 2;
  const h = r.height;
  // prettier-ignore
  const v = [
    // slope
    -w, 0, -l,   w, 0, -l,   w, h, l,   -w, h, l,
    // back face
    -w, h, l,    w, h, l,    w, 0, l,   -w, 0, l,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, r.length / 4, 0, r.length / 4, 0, 0, 1, 0, 1, 0.3, 0, 0.3], 2));
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]);
  g.computeVertexNormals();
  // Side walls (triangles) — separate so they get flat normals.
  const s = new THREE.BufferGeometry();
  s.setAttribute('position', new THREE.Float32BufferAttribute([w, 0, -l, w, 0, l, w, h, l, -w, 0, -l, -w, h, l, -w, 0, l], 3));
  s.computeVertexNormals();
  return { top: g, sides: s };
}

export function Ramps() {
  const mats = useMemo(() => {
    const t = chevronTexture();
    return {
      top: new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }),
      side: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.8, side: THREE.DoubleSide }),
    };
  }, []);
  const ramps = useMemo(() => RAMPS.map((r) => ({ r, g: rampGeometry(r) })), []);
  return (
    <group>
      {ramps.map(({ r, g }, i) => (
        <group key={i} position={[r.x, terrainAt(r.x, r.z) + 0.01, r.z]} rotation-y={r.yaw}>
          <mesh geometry={g.top} material={mats.top} castShadow receiveShadow />
          <mesh geometry={g.sides} material={mats.side} castShadow />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ dock */

export function Dock() {
  const mats = useMemo(() => {
    const t = planksTexture();
    t.repeat.set(1, dock.len / 3);
    return {
      deck: new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }),
      pile: new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 }),
    };
  }, []);
  const m = MARINA;
  const cx = (m.start.x + m.end.x) / 2;
  const cz = (m.start.z + m.end.z) / 2;
  const piles = useMemo(() => {
    const out: [number, number][] = [];
    for (let d = 14; d <= dock.len; d += 5) {
      for (const s of [-1, 1]) {
        out.push([m.start.x + m.dir.x * d - m.dir.z * m.halfW * s, m.start.z + m.dir.z * d + m.dir.x * m.halfW * s]);
      }
    }
    return out;
  }, [m]);
  return (
    <group>
      <mesh position={[cx, m.deck - 0.15, cz]} rotation-y={dock.yaw} material={mats.deck} castShadow receiveShadow>
        <boxGeometry args={[m.halfW * 2, 0.3, dock.len]} />
      </mesh>
      {piles.map(([x, z], i) => (
        <mesh key={i} position={[x, m.deck - 3.4, z]} material={mats.pile} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 7, 10]} />
        </mesh>
      ))}
    </group>
  );
}

export function Helipads() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.7, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 }), []);
  return (
    <group>
      {helipads.map((p, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[p.x, p.y + 0.08, p.z]} material={material} receiveShadow>
          <circleGeometry args={[8, 48]} />
        </mesh>
      ))}
    </group>
  );
}
