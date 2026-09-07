import { RoundedBox } from '@react-three/drei';
import { useQualityContext } from '../../hooks/QualityContext';

const TOP_Y = 0.78;
const WIDTH = 3.4;
const DEPTH = 1.4;

/** Matte desk slab on a slim metal frame, with a cold underglow. */
export function Desk() {
  const quality = useQualityContext();

  return (
    <group>
      <RoundedBox
        args={[WIDTH, 0.06, DEPTH]}
        radius={0.012}
        smoothness={3}
        position={[0, TOP_Y - 0.03, 0]}
        castShadow={quality.shadows}
        receiveShadow={quality.shadows}
      >
        <meshStandardMaterial color="#0f141b" roughness={0.62} metalness={0.22} envMapIntensity={0.7} />
      </RoundedBox>

      {/* front edge inlay */}
      <mesh position={[0, TOP_Y - 0.045, DEPTH / 2 + 0.001]}>
        <planeGeometry args={[WIDTH - 0.06, 0.006]} />
        <meshBasicMaterial color="#66e0c0" toneMapped={false} transparent opacity={0.5} />
      </mesh>

      {/* legs */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (WIDTH / 2 - 0.18), 0, 0]}>
          <mesh position={[0, TOP_Y / 2 - 0.03, 0]} castShadow={quality.shadows}>
            <boxGeometry args={[0.035, TOP_Y - 0.06, DEPTH - 0.24]} />
            <meshStandardMaterial color="#161c25" roughness={0.34} metalness={0.9} envMapIntensity={1.1} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.09, 0.02, DEPTH - 0.18]} />
            <meshStandardMaterial color="#12171f" roughness={0.4} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {/* cross brace */}
      <mesh position={[0, 0.2, -0.35]}>
        <boxGeometry args={[WIDTH - 0.5, 0.02, 0.02]} />
        <meshStandardMaterial color="#161c25" roughness={0.35} metalness={0.9} />
      </mesh>

      {/* underglow */}
      <mesh position={[0, TOP_Y - 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WIDTH - 0.4, DEPTH - 0.3]} />
        <meshBasicMaterial color="#0d3b34" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <pointLight position={[0, TOP_Y - 0.3, 0]} color="#66e0c0" intensity={2.4} distance={2.4} decay={2} />
    </group>
  );
}

export const DESK = { TOP_Y, WIDTH, DEPTH };
