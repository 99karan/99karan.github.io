import { useMemo } from 'react';
import { Instance, Instances, RoundedBox } from '@react-three/drei';
import { useQualityContext } from '../../hooks/QualityContext';
import { DESK } from './Desk';

const COLS = 15;
const ROWS = 5;
const PITCH = 0.0672;
const CAP = 0.056;

/** Low-profile mechanical board. Keycaps are instanced — one draw call. */
export function Keyboard() {
  const quality = useQualityContext();

  const caps = useMemo(() => {
    const out: { key: string; x: number; z: number; warm: boolean }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // skip a couple of slots so the layout does not read as a flat grid
        if (r === ROWS - 1 && c > 2 && c < 9) continue;
        out.push({
          key: `${r}-${c}`,
          x: (c - (COLS - 1) / 2) * PITCH,
          z: (r - (ROWS - 1) / 2) * PITCH,
          warm: r === 0 || (r === 2 && c > 3 && c < 8),
        });
      }
    }
    return out;
  }, []);

  return (
    <group position={[0, DESK.TOP_Y + 0.012, 0.36]} rotation={[-0.035, 0, 0]}>
      <RoundedBox
        args={[COLS * PITCH + 0.07, 0.026, ROWS * PITCH + 0.07]}
        radius={0.008}
        smoothness={3}
        castShadow={quality.shadows}
        receiveShadow={quality.shadows}
      >
        <meshStandardMaterial color="#12171f" roughness={0.44} metalness={0.75} envMapIntensity={1} />
      </RoundedBox>

      {/* backlight bleeding out from under the caps */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[COLS * PITCH + 0.02, ROWS * PITCH + 0.02]} />
        <meshBasicMaterial color="#1c6f60" toneMapped={false} transparent opacity={0.75} />
      </mesh>

      {quality.keycaps ? (
        <Instances limit={caps.length} range={caps.length} castShadow={quality.shadows}>
          <boxGeometry args={[CAP, 0.018, CAP]} />
          <meshStandardMaterial color="#0b0f15" roughness={0.68} metalness={0.25} />
          {caps.map((cap) => (
            <Instance key={cap.key} position={[cap.x, 0.026, cap.z]} color={cap.warm ? '#16202a' : '#0b0f15'} />
          ))}
        </Instances>
      ) : (
        <mesh position={[0, 0.026, 0]}>
          <boxGeometry args={[COLS * PITCH, 0.016, ROWS * PITCH]} />
          <meshStandardMaterial color="#0b0f15" roughness={0.68} metalness={0.25} />
        </mesh>
      )}

      <pointLight position={[0, 0.06, 0]} color="#66e0c0" intensity={0.85} distance={0.9} decay={2} />
    </group>
  );
}
