import { RoundedBox } from '@react-three/drei';
import { useQualityContext } from '../../hooks/QualityContext';
import { DESK } from './Desk';

/** Small props that stop the desk reading as an empty CAD scene. */
export function DeskProps() {
  const quality = useQualityContext();
  if (!quality.props) return null;

  return (
    <group>
      {/* mug */}
      <group position={[-0.95, DESK.TOP_Y + 0.055, 0.42]}>
        <mesh castShadow={quality.shadows}>
          <cylinderGeometry args={[0.052, 0.046, 0.11, quality.segments * 2, 1, true]} />
          <meshStandardMaterial color="#1a212b" roughness={0.5} metalness={0.3} side={2} />
        </mesh>
        <mesh position={[0, -0.054, 0]}>
          <cylinderGeometry args={[0.046, 0.046, 0.006, quality.segments * 2]} />
          <meshStandardMaterial color="#1a212b" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.046, quality.segments * 2]} />
          <meshStandardMaterial color="#0a0d12" roughness={0.15} metalness={0.1} />
        </mesh>
        <mesh position={[0.062, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.028, 0.007, 6, 14, Math.PI]} />
          <meshStandardMaterial color="#1a212b" roughness={0.5} metalness={0.3} />
        </mesh>
      </group>

      {/* notebook + pen */}
      <group position={[-0.62, DESK.TOP_Y + 0.012, 0.52]} rotation={[0, 0.28, 0]}>
        <RoundedBox args={[0.3, 0.018, 0.21]} radius={0.004} smoothness={2} castShadow={quality.shadows}>
          <meshStandardMaterial color="#141a23" roughness={0.8} metalness={0.05} />
        </RoundedBox>
        <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.28, 0.19]} />
          <meshStandardMaterial color="#1b222c" roughness={0.9} />
        </mesh>
        <mesh position={[0.02, 0.026, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.005, 0.005, 0.16, 6]} />
          <meshStandardMaterial color="#2b333f" roughness={0.35} metalness={0.7} />
        </mesh>
      </group>

      {/* mouse */}
      <mesh position={[0.62, DESK.TOP_Y + 0.024, 0.4]} rotation={[0, -0.12, 0]} castShadow={quality.shadows} scale={[1, 0.6, 1.45]}>
        <sphereGeometry args={[0.045, quality.segments * 2, quality.segments]} />
        <meshStandardMaterial color="#10161e" roughness={0.42} metalness={0.6} />
      </mesh>
    </group>
  );
}
