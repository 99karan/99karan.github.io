import { RoundedBox } from '@react-three/drei';
import { useCanvasTexture } from '../../lib/canvasTexture';
import { drawPhone } from '../../lib/screens';
import { useQualityContext } from '../../hooks/QualityContext';
import { DESK } from './Desk';

const W = 0.33;
const H = 0.68;

/** The phone the Flutter work actually ships to, propped on a small stand. */
export function Phone() {
  const quality = useQualityContext();
  const texture = useCanvasTexture(
    Math.round(512 * quality.textureScale),
    Math.round(1024 * quality.textureScale),
    drawPhone,
  );

  return (
    <group position={[1.06, DESK.TOP_Y + 0.02, 0.2]} rotation={[0, -0.42, 0]}>
      {/* stand */}
      <mesh position={[0, 0.01, -0.04]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.16, 0.012, 0.16]} />
        <meshStandardMaterial color="#161c25" roughness={0.3} metalness={0.92} />
      </mesh>

      <group position={[0, H / 2 * Math.cos(0.35) - 0.01, -H / 2 * Math.sin(0.35) + 0.06]} rotation={[-0.35, 0, 0]}>
        <RoundedBox args={[W, H, 0.016]} radius={0.026} smoothness={4} castShadow={quality.shadows}>
          <meshStandardMaterial color="#0a0e14" roughness={0.34} metalness={0.85} envMapIntensity={1.1} />
        </RoundedBox>
        <mesh position={[0, 0, 0.0092]}>
          <planeGeometry args={[W - 0.022, H - 0.03]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.1, 0.3]} color="#66e0c0" intensity={0.55} distance={1} decay={2} />
      </group>
    </group>
  );
}
