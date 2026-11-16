import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCanvasTexture, roundRect } from '../../lib/canvasTexture';
import { display, mono, rgba } from '../../lib/palette';
import { drawMilestone, drawProjectMock, drawResumePage } from '../../lib/screens';
import { profile, socials, stats } from '../../data/portfolio';
import { useProjectImage } from '../../hooks/useProjectImage';
import { runtime } from '../state';
import {
  aboutPavilion,
  billboards,
  boathouse,
  contactPad,
  gates,
  hangar,
  houses,
  lamps,
  lighthouse,
  monoliths,
  resumeHQ,
  scatterTrees,
  tower,
  zones,
  type TreeSpot,
} from './placements';
import { fbm, MOUNTAIN, rng, RUNWAY, terrainAt, coastRadius } from './map';

const ACCENT = '#66e0c0';

/* ------------------------------------------------------------ materials */

const M = {
  stone: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.55, metalness: 0.2 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.85 }),
  white: new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: '#8e959e', roughness: 0.35, metalness: 0.8 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: '#30343a', roughness: 0.4, metalness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#16303f', roughness: 0.05, metalness: 0.7, clearcoat: 1, envMapIntensity: 1.6 }),
  wood: new THREE.MeshStandardMaterial({ color: '#8a6440', roughness: 0.85 }),
  accent: new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.2, roughness: 0.4 }),
  window: new THREE.MeshStandardMaterial({ color: '#2a3946', emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 0.2, metalness: 0.4 }),
};

/** Lit windows, lamp bulbs and glow strips brighten after dark. */
function useNightGlow() {
  useFrame(() => {
    const k = runtime.nightMix;
    M.window.emissiveIntensity = k * 1.6;
    M.accent.emissiveIntensity = 0.8 + k * 1.8;
  });
}

/* --------------------------------------------------------------- signs */

function signTexture(title: string, subtitle: string, accent = ACCENT, w = 1024, h = 320) {
  return createCanvasTexture(w, h, (ctx) => {
    ctx.fillStyle = 'rgba(8,11,17,0.92)';
    roundRect(ctx, 0, 0, w, h, h * 0.08);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(h * 0.12, h * 0.2, 6, h * 0.6);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = display(h * 0.3, 600);
    ctx.fillText(title, h * 0.22, h * 0.5);
    ctx.fillStyle = rgba('#99a3b6', 0.95);
    ctx.font = mono(h * 0.11);
    ctx.fillText(subtitle.toUpperCase(), h * 0.23, h * 0.74);
  });
}

function Panel({
  texture,
  width,
  height,
  emissive = 0.9,
  ...props
}: { texture: THREE.Texture; width: number; height: number; emissive?: number } & JSX.IntrinsicElements['group']) {
  // One-sided: a panel seen from behind must not show its text mirrored.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: '#ffffff',
        emissiveIntensity: emissive,
        roughness: 0.4,
        transparent: true,
        alphaTest: 0.02,
      }),
    [texture, emissive],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group {...props}>
      <mesh material={material}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

/** Floating label above each zone, always facing the camera. */
function ZoneLabel({ x, y, z, title, subtitle }: { x: number; y: number; z: number; title: string; subtitle: string }) {
  const texture = useMemo(() => signTexture(title, subtitle), [title, subtitle]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <Billboard position={[x, y, z]}>
      <Panel texture={texture} width={6.4} height={2} emissive={0.7} />
    </Billboard>
  );
}

/** Glowing ring on the ground marking an interactive zone. */
function ZonePad({ x, z, r }: { x: number; z: number; r: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
    [],
  );
  const y = terrainAt(x, z);
  useFrame(({ clock }) => {
    material.opacity = 0.45 + Math.sin(clock.elapsedTime * 2.4) * 0.2;
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.2;
  });
  return (
    <group position={[x, y + 0.1, z]} rotation-x={-Math.PI / 2}>
      <mesh ref={ref} material={material}>
        <ringGeometry args={[r - 0.35, r, 64, 1, 0, Math.PI * 1.8]} />
      </mesh>
    </group>
  );
}

export function ZoneMarkers() {
  return (
    <group>
      {zones.map((z) =>
        z.kind === 'milestone' ? null : (
          <group key={z.id}>
            <ZonePad x={z.x} z={z.z} r={z.r * 0.75} />
          </group>
        ),
      )}
      {/* labels for the big destinations, visible from afar */}
      {zones
        .filter((z) => ['about', 'skills', 'contact', 'resume'].includes(z.kind))
        .map((z) => (
          <ZoneLabel key={z.id} x={z.x} y={terrainAt(z.x, z.z) + (z.kind === 'contact' ? 9 : 11)} z={z.z} title={z.title} subtitle={z.subtitle} />
        ))}
      <ZoneLabel x={billboards[0] ? (billboards[0].x + billboards[billboards.length - 1].x) / 2 : 0} y={(billboards[0]?.y ?? 0) + 16} z={billboards[0] ? (billboards[0].z + billboards[billboards.length - 1].z) / 2 : 0} title="Projects" subtitle="Drive up to a screen" />
    </group>
  );
}

/* ---------------------------------------------------------------- about */

export function AboutPavilion() {
  const p = aboutPavilion;
  const card = useMemo(
    () =>
      createCanvasTexture(1024, 640, (ctx, w, h) => {
        ctx.fillStyle = '#0a0e15';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(0, 0, 10, h);
        ctx.fillStyle = rgba(ACCENT, 0.9);
        ctx.font = mono(26, 500);
        ctx.fillText('01 — ' + profile.about.heading, 60, 80);
        ctx.fillStyle = '#e8ecf4';
        ctx.font = display(76, 600);
        ctx.fillText(profile.name, 60, 175);
        ctx.fillStyle = '#99a3b6';
        ctx.font = display(32, 400);
        ctx.fillText(profile.role, 60, 228);
        ctx.font = display(30, 300);
        ctx.fillStyle = '#c9d0dc';
        const words = profile.about.body.split(' ');
        let line = '';
        let y = 310;
        for (const word of words) {
          const test = line + word + ' ';
          if (ctx.measureText(test).width > w - 120) {
            ctx.fillText(line, 60, y);
            line = word + ' ';
            y += 42;
          } else line = test;
        }
        ctx.fillText(line, 60, y);
        stats.forEach((s, i) => {
          const x = 60 + i * 235;
          ctx.fillStyle = ACCENT;
          ctx.font = display(40, 600);
          ctx.fillText(s.value, x, h - 80);
          ctx.fillStyle = '#8a93a6';
          ctx.font = mono(18);
          ctx.fillText(s.label.toUpperCase(), x, h - 48);
        });
      }),
    [],
  );
  useEffect(() => () => card.dispose(), [card]);
  const roof = useMemo(() => new THREE.CylinderGeometry(9, 9.6, 0.6, 6), []);

  return (
    <group position={[p.x, p.y, p.z]} rotation-y={p.yaw}>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        // Pillars are registered in world space; mirror that here (undo group yaw).
        const wx = Math.cos(a) * 7;
        const wz = Math.sin(a) * 7;
        const c = Math.cos(-p.yaw);
        const s = Math.sin(-p.yaw);
        return (
          <mesh key={i} position={[wx * c + wz * s, 3, -wx * s + wz * c]} material={M.white} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 6, 16]} />
          </mesh>
        );
      })}
      <mesh geometry={roof} position={[0, 6.3, 0]} rotation-y={0.3 - p.yaw} material={M.white} castShadow receiveShadow />
      <mesh position={[0, 5.98, 0]} rotation-y={0.3 - p.yaw} material={M.accent}>
        <cylinderGeometry args={[9.62, 9.62, 0.08, 6]} />
      </mesh>
      {/* info wall at the back */}
      <group position={[0, 0, -4]}>
        <RoundedBox args={[7.4, 4.8, 0.4]} radius={0.12} position={[0, 2.9, -0.25]} material={M.stone} castShadow />
        <Panel texture={card} width={7} height={4.37} position={[0, 2.9, -0.04]} emissive={1} />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- resume */

export function ResumeHQ() {
  const r = resumeHQ;
  const page = useMemo(() => createCanvasTexture(850, 1100, drawResumePage(profile.name, profile.role)), []);
  useEffect(() => () => page.dispose(), [page]);
  return (
    <group position={[r.x, r.y, r.z]} rotation-y={r.yaw}>
      {/* building */}
      <group position={[0, 0, -9]}>
        <mesh position={[0, 4.5, 0]} material={M.concrete} castShadow receiveShadow>
          <boxGeometry args={[16, 9, 10]} />
        </mesh>
        <mesh position={[0, 4.2, 5.02]} material={M.glass}>
          <planeGeometry args={[12, 6.5]} />
        </mesh>
        {[-4, 0, 4].map((x) => (
          <mesh key={x} position={[x, 4.2, 5.06]} material={M.darkSteel}>
            <boxGeometry args={[0.15, 6.5, 0.1]} />
          </mesh>
        ))}
        <mesh position={[0, 9.1, 0]} material={M.accent}>
          <boxGeometry args={[16.1, 0.18, 10.1]} />
        </mesh>
      </group>
      {/* the page, standing like a monument */}
      <group position={[4.5, 0, -1]} rotation-y={-0.35}>
        <mesh position={[0, 0.25, 0]} material={M.stone}>
          <boxGeometry args={[4.6, 0.5, 1.2]} />
        </mesh>
        <group position={[0, 3.6, 0]} rotation-x={-0.08}>
          <mesh position={[0, 0, -0.06]} material={M.white} castShadow>
            <boxGeometry args={[4.5, 5.9, 0.1]} />
          </mesh>
          <Panel texture={page} width={4.4} height={5.7} emissive={0.55} />
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- skills */

function Monolith({ m }: { m: (typeof monoliths)[number] }) {
  const tex = useMemo(
    () =>
      createCanvasTexture(256, 1024, (ctx, w, h) => {
        ctx.fillStyle = '#14171c';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = m.skill.accent;
        ctx.font = display(96, 600);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.skill.name.toUpperCase(), 0, -16);
        ctx.fillStyle = '#8a93a6';
        ctx.font = mono(30);
        ctx.fillText(`RING ${m.skill.ring + 1}`, 0, 72);
        ctx.restore();
      }),
    [m],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: m.skill.accent, emissive: m.skill.accent, emissiveIntensity: 1.6 }), [m]);
  return (
    <group position={[m.x, m.y, m.z]} rotation-y={m.yaw}>
      <mesh position={[0, m.h / 2, 0]} material={M.stone} castShadow receiveShadow>
        <boxGeometry args={[2.2, m.h, 1]} />
      </mesh>
      <Panel texture={tex} width={1.9} height={m.h - 0.6} position={[0, m.h / 2, 0.51]} emissive={0.9} />
      <mesh position={[0, m.h + 0.06, 0]} material={glow}>
        <boxGeometry args={[2.22, 0.12, 1.02]} />
      </mesh>
    </group>
  );
}

export function SkillGarden() {
  return (
    <group>
      {monoliths.map((m) => (
        <Monolith key={m.skill.name} m={m} />
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- projects */

function ProjectBoard({ b }: { b: (typeof billboards)[number] }) {
  const mock = useMemo(() => createCanvasTexture(1280, 800, drawProjectMock(b.project)), [b]);
  useEffect(() => () => mock.dispose(), [mock]);
  const tex = useProjectImage(b.project.image, mock);
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.4, metalness: 0.6 }), []);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: b.project.accent, emissive: b.project.accent, emissiveIntensity: 1.5 }), [b]);
  return (
    <group position={[b.x, b.y, b.z]} rotation-y={b.yaw}>
      {[-5, 5].map((x) => (
        <mesh key={x} position={[x, 5.5, -0.4]} material={M.darkSteel} castShadow>
          <boxGeometry args={[0.6, 11, 0.6]} />
        </mesh>
      ))}
      <mesh position={[0, 7.4, -0.25]} material={frame} castShadow>
        <boxGeometry args={[11.6, 7.2, 0.4]} />
      </mesh>
      <mesh position={[0, 3.72, -0.25]} material={edge}>
        <boxGeometry args={[11.6, 0.1, 0.42]} />
      </mesh>
      <Panel texture={tex} width={11} height={6.875} position={[0, 7.4, -0.03]} emissive={1.05} />
    </group>
  );
}

export function ProjectGallery() {
  return (
    <group>
      {billboards.map((b) => (
        <ProjectBoard key={b.project.id} b={b} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------ experience */

function Gate({ g }: { g: (typeof gates)[number] }) {
  const tex = useMemo(
    () =>
      createCanvasTexture(1024, 400, (ctx, w, h) => {
        ctx.fillStyle = '#0a0e15';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(0, h - 8, w, 8);
        ctx.save();
        ctx.translate(56, 34);
        drawMilestone(g.milestone)(ctx, w - 100, h - 70);
        ctx.restore();
      }),
    [g],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[g.x, g.y, g.z]} rotation-y={g.yaw}>
      {[-6.8, 6.8].map((x) => (
        <mesh key={x} position={[x, 4, 0]} material={M.white} castShadow>
          <boxGeometry args={[1.2, 8, 1.2]} />
        </mesh>
      ))}
      <mesh position={[0, 8.3, 0]} material={M.white} castShadow>
        <boxGeometry args={[15, 0.8, 1.3]} />
      </mesh>
      <mesh position={[0, 7.86, 0]} material={M.accent}>
        <boxGeometry args={[12.4, 0.08, 1.32]} />
      </mesh>
      {/* readable from both directions of travel */}
      <Panel texture={tex} width={9} height={3.5} position={[0, 5.9, -0.66]} rotation-y={Math.PI} />
      <Panel texture={tex} width={9} height={3.5} position={[0, 5.9, 0.66]} />
    </group>
  );
}

export function CareerGates() {
  return (
    <group>
      {gates.map((g) => (
        <Gate key={g.milestone.id} g={g} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- lighthouse */

export function Lighthouse() {
  const L = lighthouse;
  const beam = useRef<THREE.Group>(null);
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [],
  );
  const stripes = useMemo(() => {
    const t = createCanvasTexture(64, 256, (ctx, w, h) => {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#c8102e' : '#f4f4f0';
        ctx.fillRect(0, (i * h) / 6, w, h / 6);
      }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
  }, []);
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#fff1b0', emissiveIntensity: 1 }), []);
  const sign = useMemo(() => {
    return createCanvasTexture(1024, 640, (ctx, w, h) => {
      ctx.fillStyle = '#0a0e15';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = ACCENT;
      ctx.font = mono(26, 500);
      ctx.fillText('05 — CONTACT', 56, 72);
      ctx.fillStyle = '#e8ecf4';
      ctx.font = display(64, 600);
      ctx.fillText(profile.contact.heading, 56, 160);
      ctx.font = display(30, 300);
      ctx.fillStyle = '#c9d0dc';
      ctx.fillText(profile.contact.body, 56, 215);
      socials.forEach((s, i) => {
        const y = 320 + i * 90;
        ctx.fillStyle = ACCENT;
        ctx.font = mono(24, 500);
        ctx.fillText(s.label.toUpperCase(), 56, y);
        ctx.fillStyle = '#e8ecf4';
        ctx.font = display(40, 500);
        ctx.fillText(s.handle, 300, y + 4);
      });
    });
  }, []);
  useEffect(() => () => sign.dispose(), [sign]);

  useFrame(({ clock }) => {
    const k = runtime.nightMix;
    lamp.emissiveIntensity = 1 + k * 6;
    beamMat.opacity = k * 0.22;
    if (beam.current) {
      beam.current.rotation.y = clock.elapsedTime * 0.6;
      beam.current.visible = k > 0.05;
    }
  });

  const toCentre = Math.atan2(contactPad.x - L.x, contactPad.z - L.z);
  const H = 22;

  return (
    <group position={[L.x, L.y, L.z]}>
      <mesh position={[0, 0.6, 0]} material={M.concrete} receiveShadow castShadow>
        <cylinderGeometry args={[4.2, 4.6, 1.2, 24]} />
      </mesh>
      <mesh position={[0, 1.2 + H / 2, 0]} material={stripes} castShadow>
        <cylinderGeometry args={[1.8, 2.8, H, 28]} />
      </mesh>
      <mesh position={[0, 1.2 + H + 0.2, 0]} material={M.darkSteel}>
        <cylinderGeometry args={[2.6, 2.6, 0.4, 24]} />
      </mesh>
      <mesh position={[0, 1.2 + H + 1.5, 0]} material={M.glass}>
        <cylinderGeometry args={[1.5, 1.5, 2.2, 16]} />
      </mesh>
      <mesh position={[0, 1.2 + H + 1.5, 0]} material={lamp}>
        <sphereGeometry args={[0.7, 16, 12]} />
      </mesh>
      <mesh position={[0, 1.2 + H + 3.1, 0]} material={stripes}>
        <coneGeometry args={[1.8, 1.4, 16]} />
      </mesh>
      <group ref={beam} position={[0, 1.2 + H + 1.5, 0]}>
        {[0, Math.PI].map((a) => (
          <mesh key={a} rotation={[0, a, Math.PI / 2]} position={[Math.cos(a) * 40, 0, -Math.sin(a) * 40]} material={beamMat}>
            <coneGeometry args={[6, 80, 24, 1, true]} />
          </mesh>
        ))}
      </group>
      {/* contact board */}
      <group rotation-y={toCentre} position={[Math.sin(toCentre) * 5.5, 0, Math.cos(toCentre) * 5.5]}>
        <RoundedBox args={[6.8, 4.4, 0.35]} radius={0.1} position={[0, 3.4, -0.2]} material={M.stone} castShadow />
        <Panel texture={sign} width={6.4} height={4} position={[0, 3.4, 0]} />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------- airfield etc. */

export function Airfield() {
  const h = hangar;
  const arch = useMemo(() => {
    // Half-cylinder over the top: theta 0..π keeps the half with sin θ ≥ 0, which
    // becomes +Y once the axis is turned to run along X.
    const g = new THREE.CylinderGeometry(h.d / 2, h.d / 2, h.w, 32, 1, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    return g;
  }, [h]);
  const sock = useRef<THREE.Group>(null);
  const sockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.7, side: THREE.DoubleSide }), []);
  useFrame(({ clock }) => {
    if (sock.current) sock.current.rotation.z = Math.sin(clock.elapsedTime * 3) * 0.05;
  });

  return (
    <group>
      {/* hangar: arched roof, walls, open east side */}
      <group position={[h.x, h.y, h.z]}>
        <mesh geometry={arch} position={[0, h.h * 0.55, 0]} scale={[1, 0.62, 1]} castShadow receiveShadow>
          <meshStandardMaterial attach="material" color="#9aa1aa" roughness={0.45} metalness={0.7} side={THREE.DoubleSide} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, h.h * 0.3, (s * h.d) / 2]} material={M.concrete} castShadow>
            <boxGeometry args={[h.w, h.h * 0.6, 0.6]} />
          </mesh>
        ))}
        <mesh position={[-h.w / 2, h.h * 0.45, 0]} material={M.concrete} castShadow>
          <boxGeometry args={[0.6, h.h * 0.9, h.d]} />
        </mesh>
        <mesh position={[h.w / 2 - 0.3, h.h * 0.62, 0]} material={M.accent}>
          <boxGeometry args={[0.2, 0.25, h.d - 1]} />
        </mesh>
      </group>

      {/* control tower */}
      <group position={[tower.x, tower.y, tower.z]}>
        <mesh position={[0, 7, 0]} material={M.concrete} castShadow>
          <cylinderGeometry args={[1.6, 2.4, 14, 16]} />
        </mesh>
        <mesh position={[0, 15.2, 0]} material={M.glass} castShadow>
          <cylinderGeometry args={[3.2, 2.6, 2.6, 8]} />
        </mesh>
        <mesh position={[0, 16.7, 0]} material={M.white}>
          <cylinderGeometry args={[3.5, 3.5, 0.4, 8]} />
        </mesh>
        <mesh position={[0, 17.5, 0]} material={MAT_BEACON}>
          <sphereGeometry args={[0.25, 10, 8]} />
        </mesh>
      </group>

      {/* windsock */}
      <group position={[RUNWAY.x - RUNWAY.halfW - 8, RUNWAY.height, RUNWAY.z - 40]}>
        <mesh position={[0, 3, 0]} material={M.steel}>
          <cylinderGeometry args={[0.08, 0.1, 6, 8]} />
        </mesh>
        <group ref={sock} position={[0, 5.8, 0]} rotation-y={-0.8}>
          <mesh position={[0, 0, 1.1]} rotation-x={Math.PI / 2 + 0.25} material={sockMat}>
            <cylinderGeometry args={[0.45, 0.22, 2.2, 12, 1, true]} />
          </mesh>
        </group>
      </group>

      {/* boathouse */}
      <group position={[boathouse.x, boathouse.y, boathouse.z]} rotation-y={boathouse.yaw}>
        <mesh position={[0, 2.5, 0]} material={M.wood} castShadow>
          <boxGeometry args={[8, 5, 10]} />
        </mesh>
        {/* hip roof: a four-sided cone, squared to the walls */}
        <mesh position={[0, 6.4, 0]} rotation-y={Math.PI / 4} scale={[1, 1, 1]} material={M.darkSteel} castShadow>
          <coneGeometry args={[7.3, 2.8, 4]} />
        </mesh>
      </group>
    </group>
  );
}

const MAT_BEACON = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2a2a', emissiveIntensity: 3 });

/* ----------------------------------------------------------------- village */

export function Village() {
  useNightGlow();
  const roofGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0);
    s.lineTo(0.5, 0);
    s.lineTo(0, 0.42);
    s.lineTo(-0.5, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5);
    return g;
  }, []);
  const roofMats = useMemo(() => {
    const map = new Map<string, THREE.Material>();
    houses.forEach((h) => map.set(h.roof, new THREE.MeshStandardMaterial({ color: h.roof, roughness: 0.75 })));
    houses.forEach((h) => map.set(h.wall, new THREE.MeshStandardMaterial({ color: h.wall, roughness: 0.85 })));
    return map;
  }, []);

  return (
    <group>
      {houses.map((h, i) => (
        <group key={i} position={[h.x, h.y, h.z]} rotation-y={h.yaw}>
          <mesh position={[0, h.h / 2 - 0.4, 0]} material={roofMats.get(h.wall)} castShadow receiveShadow>
            <boxGeometry args={[h.w, h.h + 0.8, h.d]} />
          </mesh>
          <mesh geometry={roofGeo} position={[0, h.h, 0]} scale={[h.w + 0.8, h.w + 0.8, h.d + 0.6]} material={roofMats.get(h.roof)} castShadow />
          {/* windows and a door on the road side */}
          {[-h.w / 3, h.w / 3].map((x) => (
            <mesh key={x} position={[x, h.h * 0.55, h.d / 2 + 0.01]} material={M.window}>
              <planeGeometry args={[1.1, 1.2]} />
            </mesh>
          ))}
          <mesh position={[0, 1.1, h.d / 2 + 0.01]} material={M.wood}>
            <planeGeometry args={[1.1, 2.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- lamps */

export function StreetLamps() {
  const bulbs = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4dd', emissive: '#ffd89a', emissiveIntensity: 0.2 }), []);
  const { pole, bulb } = useMemo(() => {
    const p = new THREE.CylinderGeometry(0.09, 0.13, 6, 8);
    p.translate(0, 3, 0);
    const hd = new THREE.BoxGeometry(0.35, 0.18, 1.6);
    hd.translate(0, 6, 0.65);
    const b = new THREE.BoxGeometry(0.28, 0.06, 0.7);
    b.translate(0, 5.89, 1.0);
    return { pole: mergeGeometries([p, hd])!, bulb: b };
  }, []);
  useFrame(() => {
    bulbs.emissiveIntensity = 0.1 + runtime.nightMix * 6;
  });
  const setMatrices = (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    const o = new THREE.Object3D();
    lamps.forEach((l, i) => {
      o.position.set(l.x, l.y, l.z);
      o.rotation.set(0, l.yaw, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  return (
    <group>
      <instancedMesh args={[pole, M.darkSteel, lamps.length]} ref={setMatrices} castShadow />
      <instancedMesh args={[bulb, bulbs, lamps.length]} ref={setMatrices} />
    </group>
  );
}

/* --------------------------------------------------------------- trees */

function colored(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  // mergeGeometries needs matching attribute sets.
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  return g;
}

function treeGeometries() {
  const trunk = (h: number, r: number) => {
    const g = new THREE.CylinderGeometry(r * 0.7, r, h, 7);
    g.translate(0, h / 2, 0);
    return colored(g, '#5b4030');
  };
  const pine = (() => {
    const parts = [trunk(1.6, 0.22)];
    [
      [2.2, 3.0, 1.4],
      [1.75, 2.6, 2.9],
      [1.25, 2.2, 4.2],
    ].forEach(([r, h, y]) => {
      const c = new THREE.ConeGeometry(r, h, 9);
      c.translate(0, y + h / 2 - 0.3, 0);
      parts.push(colored(c, '#2f5d34'));
    });
    return mergeGeometries(parts)!;
  })();
  const broad = (() => {
    const parts = [trunk(2.4, 0.26)];
    [
      [0, 3.6, 0, 1.9],
      [0.9, 3.1, 0.4, 1.3],
      [-0.8, 3.3, -0.5, 1.4],
      [0.2, 4.6, -0.2, 1.3],
    ].forEach(([x, y, z, r]) => {
      const s = new THREE.IcosahedronGeometry(r, 1);
      s.translate(x, y, z);
      parts.push(colored(s, '#4f8a3a'));
    });
    return mergeGeometries(parts)!;
  })();
  const palm = (() => {
    const parts: THREE.BufferGeometry[] = [];
    const t = new THREE.CylinderGeometry(0.16, 0.26, 5.2, 7);
    t.translate(0, 2.6, 0);
    t.rotateZ(0.12);
    parts.push(colored(t, '#7a5a3a'));
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.BoxGeometry(0.5, 0.05, 2.8);
      leaf.translate(0, 0, 1.4);
      leaf.rotateX(0.5);
      leaf.rotateY((i / 7) * Math.PI * 2);
      leaf.translate(0.6, 5.2, 0);
      parts.push(colored(leaf, '#3f8a3a'));
    }
    return mergeGeometries(parts)!;
  })();
  return [pine, broad, palm];
}

export function Forest({ count, shadows }: { count: number; shadows: boolean }) {
  const trees = useMemo(() => scatterTrees(count), [count]);
  const geos = useMemo(() => treeGeometries(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), []);

  const groups = useMemo(() => {
    const by: TreeSpot[][] = [[], [], []];
    trees.forEach((t) => by[t.kind].push(t));
    return by;
  }, [trees]);

  return (
    <group>
      {groups.map((list, kind) =>
        list.length ? (
          <instancedMesh
            key={kind}
            args={[geos[kind], material, list.length]}
            castShadow={shadows}
            receiveShadow={false}
            ref={(m) => {
              if (!m) return;
              const o = new THREE.Object3D();
              const c = new THREE.Color();
              list.forEach((t, i) => {
                o.position.set(t.x, t.y - 0.1, t.z);
                o.rotation.set(0, t.rot, 0);
                o.scale.setScalar(t.s);
                o.updateMatrix();
                m.setMatrixAt(i, o.matrix);
                const tint = 0.82 + fbm(t.x * 0.05, t.z * 0.05, 2) * 0.36;
                m.setColorAt(i, c.setRGB(tint, tint * (0.95 + (i % 5) * 0.02), tint * 0.92));
              });
              m.instanceMatrix.needsUpdate = true;
              if (m.instanceColor) m.instanceColor.needsUpdate = true;
            }}
          />
        ) : null,
      )}
    </group>
  );
}

export function Rocks({ count }: { count: number }) {
  const spots = useMemo(() => {
    const r = rng(77);
    const out: { x: number; z: number; y: number; s: number; rot: [number, number, number] }[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 30) {
      const a = r() * Math.PI * 2;
      const nearMountain = r() < 0.5;
      const rad = nearMountain ? r() * 70 : coastRadius(a) - 4 - r() * 14;
      const x = nearMountain ? MOUNTAIN.x + Math.cos(a) * rad : Math.cos(a) * rad;
      const z = nearMountain ? MOUNTAIN.z + Math.sin(a) * rad : Math.sin(a) * rad;
      const y = terrainAt(x, z);
      if (y < -1 || Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < 14) continue;
      out.push({ x, z, y, s: 0.5 + r() * 1.6, rot: [r() * 3, r() * 3, r() * 3] });
    }
    return out;
  }, [count]);
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a857c', roughness: 0.95, flatShading: true }), []);
  return (
    <instancedMesh
      args={[geometry, material, spots.length]}
      castShadow
      receiveShadow
      ref={(m) => {
        if (!m) return;
        const o = new THREE.Object3D();
        spots.forEach((s, i) => {
          o.position.set(s.x, s.y + s.s * 0.2, s.z);
          o.rotation.set(...s.rot);
          o.scale.set(s.s, s.s * 0.7, s.s * 1.1);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      }}
    />
  );
}
