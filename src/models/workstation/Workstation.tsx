import { Float } from '@react-three/drei';
import { Desk } from './Desk';
import { Monitor } from './Monitor';
import { Keyboard } from './Keyboard';
import { Phone } from './Phone';
import { Lamp } from './Lamp';
import { DeskProps } from './DeskProps';
import { HoloPanel } from '../HoloPanel';
import { drawHoloCode, drawHoloMetrics, drawHoloWave } from '../../lib/screens';
import { useQualityContext } from '../../hooks/QualityContext';

/**
 * The hero island. Everything is procedural geometry so the whole workspace
 * costs a few hundred KB of code instead of a multi-megabyte GLB download.
 * See src/models/GLTFModel.tsx to swap any part for a real model.
 */
export function Workstation() {
  const quality = useQualityContext();

  return (
    <group>
      <Desk />
      <Monitor />
      <Keyboard />
      <Phone />
      <Lamp />
      <DeskProps />

      {/* holographic side panels */}
      <HoloPanel
        draw={drawHoloCode}
        width={0.95}
        height={0.66}
        position={[-1.62, 1.72, 0.05]}
        rotation={[0, 0.52, 0]}
        parallax={0.1}
        phase={0}
      />
      <HoloPanel
        draw={drawHoloMetrics}
        width={0.8}
        height={0.52}
        position={[1.58, 1.92, -0.1]}
        rotation={[0, -0.46, 0]}
        parallax={0.13}
        phase={2.1}
      />
      {quality.props && (
        <HoloPanel
          draw={drawHoloWave}
          width={0.68}
          height={0.4}
          position={[-1.88, 1.04, 0.52]}
          rotation={[0, 0.6, 0]}
          parallax={0.16}
          phase={4.3}
        />
      )}

      {/* abstract mass, kept dark and few */}
      <Float speed={1.1} rotationIntensity={0.5} floatIntensity={0.6}>
        <mesh position={[-2.25, 2.5, -1.1]}>
          <icosahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color="#111820" roughness={0.22} metalness={1} envMapIntensity={1.6} flatShading />
        </mesh>
      </Float>
      <Float speed={0.8} rotationIntensity={0.35} floatIntensity={0.5}>
        <mesh position={[2.42, 2.62, -1.4]} rotation={[0.6, 0.2, 0]}>
          <torusGeometry args={[0.24, 0.018, 8, 48]} />
          <meshStandardMaterial color="#66e0c0" roughness={0.25} metalness={0.9} emissive="#0d3b34" emissiveIntensity={1.4} />
        </mesh>
      </Float>
      {quality.props && (
        <Float speed={0.9} rotationIntensity={0.6} floatIntensity={0.4}>
          <mesh position={[-2.32, 1.16, 0.15]}>
            <octahedronGeometry args={[0.14, 0]} />
            <meshStandardMaterial color="#141b24" roughness={0.2} metalness={1} envMapIntensity={1.5} flatShading />
          </mesh>
        </Float>
      )}
    </group>
  );
}
