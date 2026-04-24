/**
 * Water.tsx
 * Fresnel ocean — реалистичное открытое море без клеток.
 * Улучшения:
 *  • глубже и богаче многослойные волны
 *  • ночная лунная дорожка (directional specular)
 *  • sub-surface scattering имитация (внутреннее свечение гребней)
 *  • caustics-подобное мерцание на мелководье
 *  • hull foam с анимированным смещением по нормали
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ─────────────────────────────────────────
   MAIN OCEAN PLANE
───────────────────────────────────────── */
const OCEAN_VERT = `
uniform float uTime;
varying vec2  vUv;
varying vec3  vWorldNormal;
varying vec3  vWorldPos;
varying float vElev;

void main() {
  vUv = uv;
  vec3 p = position;

  // 5-слойные волны разных частот и направлений
  float w1 = sin(p.x * 1.6  + uTime * 1.30) * 0.22;
  float w2 = cos(p.z * 1.40 + uTime * 1.05) * 0.18;
  float w3 = sin((p.x + p.z) * 2.8  + uTime * 2.2)  * 0.07;
  float w4 = sin(p.x * 5.2  + uTime * 3.0)  * 0.028;
  float w5 = cos(p.z * 4.8  + uTime * 2.7)  * 0.022;
  p.y += w1 + w2 + w3 + w4 + w5;
  vElev = p.y;

  // finite-diff normal
  float eps = 0.04;
  float hL = sin((p.x-eps)*1.6+uTime*1.30)*0.22 + cos(p.z*1.40+uTime*1.05)*0.18;
  float hR = sin((p.x+eps)*1.6+uTime*1.30)*0.22 + cos(p.z*1.40+uTime*1.05)*0.18;
  float hD = sin(p.x*1.6+uTime*1.30)*0.22 + cos((p.z-eps)*1.40+uTime*1.05)*0.18;
  float hU = sin(p.x*1.6+uTime*1.30)*0.22 + cos((p.z+eps)*1.40+uTime*1.05)*0.18;
  vWorldNormal = normalize(vec3(hL-hR, 2.0*eps, hD-hU));

  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const OCEAN_FRAG = `
uniform float uTime;
uniform vec3  uCamPos;
varying vec2  vUv;
varying vec3  vWorldNormal;
varying vec3  vWorldPos;
varying float vElev;

void main() {
  vec3 N = normalize(vWorldNormal);

  // детальное нормал-возмущение (имитация ряби)
  float nx = sin(vUv.x * 32.0 + uTime * 2.1) * 0.052
           + sin(vUv.x * 68.0 - uTime * 3.4) * 0.018;
  float nz = cos(vUv.y * 28.0 + uTime * 1.7) * 0.044
           + cos(vUv.y * 54.0 + uTime * 2.9) * 0.016;
  N = normalize(N + vec3(nx, 0.0, nz));

  // Fresnel
  vec3  V       = normalize(uCamPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);

  // цвета воды
  vec3 abyssColor   = vec3(0.002, 0.010, 0.055);  // глубокая ночная бездна
  vec3 deepColor    = vec3(0.004, 0.022, 0.090);
  vec3 midColor     = vec3(0.010, 0.072, 0.26);
  vec3 fresnelColor = vec3(0.22,  0.48,  0.82);

  float elev01 = smoothstep(-0.30, 0.30, vElev);
  vec3  col    = mix(abyssColor, midColor, elev01);
  col          = mix(col, fresnelColor, fresnel * 0.68);

  // sub-surface scattering на гребнях волн
  float sss = smoothstep(0.14, 0.35, vElev);
  col = mix(col, vec3(0.04, 0.28, 0.55), sss * 0.32);

  // лунная/солнечная дорожка — главный specular
  vec3  L    = normalize(vec3(8.0, 22.0, 12.0));
  vec3  H    = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 120.0) * 0.70;
  col += vec3(0.85, 0.92, 1.00) * spec;

  // вторичный specular (луна с другой стороны)
  vec3  L2   = normalize(vec3(-5.0, 18.0, -8.0));
  vec3  H2   = normalize(L2 + V);
  float sp2  = pow(max(dot(N, H2), 0.0), 80.0) * 0.30;
  col += vec3(0.70, 0.80, 1.00) * sp2;

  // caustics-мерцание на мелководье
  float caus = pow(max(0.0, sin(vUv.x*48.0+uTime*1.8)*sin(vUv.y*42.0-uTime*1.3)), 8.0);
  col += caus * 0.10 * smoothstep(0.0, -0.15, vElev);

  // foam crests
  float foam = smoothstep(0.16, 0.32, vElev);
  col = mix(col, vec3(0.78, 0.90, 1.00), foam * 0.50);

  // мелкие блики ряби
  float rip = pow(max(0.0, sin(vUv.x*58.0+uTime*2.5)*sin(vUv.y*52.0+uTime*1.9)), 12.0);
  col += rip * 0.08;

  float alpha = 0.94 + fresnel * 0.06;
  gl_FragColor = vec4(col, alpha);
}
`

export const OceanPlane: React.FC<{ centerZ: number }> = ({ centerZ }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
  }), [])

  useFrame(({ clock, camera }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value   = clock.getElapsedTime()
    matRef.current.uniforms.uCamPos.value.copy(camera.position)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.30, centerZ]} receiveShadow>
      {/* больше сегментов = более плавные волны */}
      <planeGeometry args={[80, 80, 120, 120]} />
      <shaderMaterial
        ref={matRef}
        transparent
        uniforms={uniforms}
        vertexShader={OCEAN_VERT}
        fragmentShader={OCEAN_FRAG}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

/* ─────────────────────────────────────────
   HULL FOAM STRIP
───────────────────────────────────────── */
const FOAM_VERT = `
uniform float uTime;
varying vec2  vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(p.x * 6.0 + uTime * 3.5) * 0.020;
  // поднимаем пену чуть выше поверхности волны
  p.y += sin(p.x * 3.2 + uTime * 1.8) * 0.04;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const FOAM_FRAG = `
uniform float uTime;
varying vec2  vUv;
void main() {
  float fade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float n = sin(vUv.x * 34.0 + uTime * 2.2) * sin(vUv.y * 18.0 - uTime * 1.4);
  float foam = smoothstep(0.18, 0.72, n) * fade;
  vec3 col = mix(vec3(0.03, 0.10, 0.26), vec3(0.82, 0.93, 1.0), foam);
  gl_FragColor = vec4(col, foam * 0.80);
}
`

interface HullFoamProps {
  shipX: number; shipZ: number
  shipLength: number; shipWidth: number
}
export const HullFoam: React.FC<HullFoamProps> = ({ shipX, shipZ, shipLength, shipWidth }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })
  const hw = shipWidth / 2 + 0.06
  return (
    <group position={[shipX, -0.24, shipZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, hw, 0]}>
        <planeGeometry args={[shipLength, 0.26, 24, 4]} />
        <shaderMaterial ref={matRef} transparent uniforms={uniforms}
          vertexShader={FOAM_VERT} fragmentShader={FOAM_FRAG}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -hw, 0]}>
        <planeGeometry args={[shipLength, 0.26, 24, 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={FOAM_VERT} fragmentShader={FOAM_FRAG}
          transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
