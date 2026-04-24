import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Board, Ship } from '../game/types'

/* ─── CONSTANTS ─── */
const CELL  = 1.1
const BOARD = 10 * CELL
const OFF   = -BOARD / 2 + CELL / 2
const PLAYER_Z = 0
const ENEMY_Z  = BOARD + 12

/* ─── WATER TILE ─── */
const TILE_VERT = `
uniform float uTime; uniform float uHover; uniform float uHit; uniform float uMiss;
varying vec2 vUv; varying float vElev;
void main(){
  vUv=uv; vec3 p=position;
  p.z+=sin(p.x*4.2+uTime*2.2)*0.055+cos(p.y*3.8+uTime*1.7)*0.045;
  p.z+=uHover*(sin(uTime*8.0)*0.03+0.05);
  vElev=p.z;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`
const TILE_FRAG = `
uniform float uTime; uniform float uHover; uniform float uHit; uniform float uMiss;
varying vec2 vUv; varying float vElev;
void main(){
  vec3 deep=vec3(0.005,0.025,0.10);
  vec3 mid =vec3(0.02,0.10,0.34);
  vec3 foam=vec3(0.55,0.80,1.0);
  float d=length(vUv-0.5)*2.0;
  vec3 col=mix(mid,deep,smoothstep(0.0,1.0,d));
  col=mix(col,foam,smoothstep(0.06,0.20,vElev)*0.45);
  // specular
  float spec=pow(max(0.0,vElev*8.0),3.0)*0.18;
  col+=spec;
  // grid edge
  float ex=smoothstep(0.45,0.5,abs(vUv.x-0.5)*2.0);
  float ey=smoothstep(0.45,0.5,abs(vUv.y-0.5)*2.0);
  float edge=max(ex,ey);
  vec3 eCol=mix(vec3(0.08,0.25,0.75),vec3(0.9,0.82,0.12),uHover);
  col=mix(col,eCol,edge*(0.22+uHover*0.38));
  col=mix(col,vec3(0.92,0.88,0.14),uHover*0.22*(1.0-d));
  // hit fire
  float hf=(1.0-d)*uHit;
  col=mix(col,vec3(1.0,0.18,0.02)*(abs(sin(uTime*22.0))*0.4+0.6),hf*0.96);
  col+=vec3(1.0,0.5,0.0)*smoothstep(0.7,0.1,d)*uHit*0.5*(sin(uTime*28.0)*0.35+0.65);
  // miss ripple
  float rip=abs(sin(d*18.0-uTime*5.5))*(1.0-d)*uMiss;
  col=mix(col,vec3(0.3,0.62,1.0),rip*0.6);
  gl_FragColor=vec4(col,0.94+uHit*0.06);
}
`

interface TileProps {
  gx:number; gy:number; wx:number; wz:number
  hit:boolean; miss:boolean
  interactive:boolean
  onClickCell?:(x:number,y:number)=>void
}
const WaterTile:React.FC<TileProps>=({gx,gy,wx,wz,hit,miss,interactive,onClickCell})=>{
  const matRef=useRef<THREE.ShaderMaterial>(null)
  const t0=useRef(Math.random()*100)
  const [hov,setHov]=useState(false)
  const uniforms=useMemo(()=>({
    uTime:{value:0},uHover:{value:0},
    uHit:{value:hit?1:0},uMiss:{value:miss?1:0}
  }),[])
  useEffect(()=>{
    if(!matRef.current)return
    matRef.current.uniforms.uHit.value=hit?1:0
    matRef.current.uniforms.uMiss.value=miss?1:0
  },[hit,miss])
  useFrame(({clock})=>{
    if(!matRef.current)return
    matRef.current.uniforms.uTime.value=clock.getElapsedTime()+t0.current
    const target=(hov&&interactive&&!hit&&!miss)?1:0
    matRef.current.uniforms.uHover.value+=(target-matRef.current.uniforms.uHover.value)*0.15
  })
  const canClick=interactive&&!hit&&!miss
  return(
    <mesh position={[wx,0,wz]} rotation={[-Math.PI/2,0,0]}
      onPointerEnter={()=>canClick&&setHov(true)}
      onPointerLeave={()=>setHov(false)}
      onClick={()=>canClick&&onClickCell?.(gx,gy)}>
      <planeGeometry args={[CELL*0.91,CELL*0.91,22,22]}/>
      <shaderMaterial ref={matRef} transparent uniforms={uniforms}
        vertexShader={TILE_VERT} fragmentShader={TILE_FRAG}/>
    </mesh>
  )
}

/* ─── OCEAN BG ─── */
const OCN_VERT=`uniform float uTime; varying vec2 vUv;
void main(){vUv=uv;vec3 p=position;
  p.y+=sin(p.x*0.9+uTime*0.75)*0.22+cos(p.z*0.8+uTime*0.6)*0.16;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}
`
const OCN_FRAG=`varying vec2 vUv;uniform float uTime;
void main(){
  vec3 c=mix(vec3(0.004,0.015,0.06),vec3(0.01,0.045,0.16),vUv.y);
  float f=pow(max(0.0,sin(vUv.x*60.0+uTime)*sin(vUv.y*55.0+uTime*0.95)),16.0);
  c+=f*0.09;
  gl_FragColor=vec4(c,1.0);}
`
const Ocean:React.FC<{cz:number}>=({cz})=>{
  const ref=useRef<THREE.ShaderMaterial>(null)
  useFrame(({clock})=>{if(ref.current)ref.current.uniforms.uTime.value=clock.getElapsedTime()})
  return(
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.32,cz]}>
      <planeGeometry args={[80,80,70,70]}/>
      <shaderMaterial ref={ref} uniforms={{uTime:{value:0}}}
        vertexShader={OCN_VERT} fragmentShader={OCN_FRAG}/>
    </mesh>
  )
}

/* ─── SHIP MODELS ─── */
// size 1 = sloop, 2 = brig, 3 = frigate, 4 = galleon
interface ShipModelProps{
  wx:number;wz:number;size:number;horizontal:boolean
  visible:boolean;sunk:boolean;isPlayer:boolean
}

const PirateShip:React.FC<ShipModelProps>=({wx,wz,size,horizontal,visible,sunk,isPlayer})=>{
  const grp=useRef<THREE.Group>(null)
  const t0=useRef(Math.random()*100)
  const sunkProgress=useRef(0)

  useFrame(({clock})=>{
    if(!grp.current)return
    const e=clock.getElapsedTime()+t0.current
    if(sunk){
      sunkProgress.current=Math.min(sunkProgress.current+0.004,1)
      grp.current.position.y=-sunkProgress.current*1.4
      grp.current.rotation.z=sunkProgress.current*0.9
      grp.current.rotation.x=sunkProgress.current*0.25
    } else {
      grp.current.position.y=Math.sin(e*0.55)*0.1
      grp.current.rotation.z=Math.sin(e*0.42)*0.028
      grp.current.rotation.x=Math.cos(e*0.36)*0.014
    }
  })

  if(!visible)return null

  // — per-size geometry parameters —
  const cfg = {
    1: { L:0.90, W:0.52, H:0.30, masts:1, mastH:1.10, sailW:0.55, cannons:0, hasCrowsNest:false, sternH:0.12, bowLen:0.32 },
    2: { L:1.30, W:0.62, H:0.36, masts:1, mastH:1.35, sailW:0.72, cannons:2, hasCrowsNest:false, sternH:0.16, bowLen:0.38 },
    3: { L:1.85, W:0.74, H:0.42, masts:2, mastH:1.60, sailW:0.82, cannons:3, hasCrowsNest:true,  sternH:0.22, bowLen:0.44 },
    4: { L:2.50, W:0.88, H:0.50, masts:3, mastH:1.85, sailW:0.95, cannons:4, hasCrowsNest:true,  sternH:0.30, bowLen:0.52 },
  }[Math.max(1,Math.min(4,size))] as {
    L:number;W:number;H:number;masts:number;mastH:number;
    sailW:number;cannons:number;hasCrowsNest:boolean;sternH:number;bowLen:number
  }

  const sc    = 0.82
  const ry    = horizontal?0:Math.PI/2
  const hullC = sunk?'#1a0808':isPlayer?'#152844':'#1c1005'
  const deckC = sunk?'#120404':isPlayer?'#0d1d32':'#110c03'
  const sailC = sunk?'#1e1010':isPlayer?'#cce4ff':'#f2ead8'
  const mastC = '#6e3e12'
  const ropeC = '#7a5a0e'
  const metalC= '#2a3344'
  const goldC = sunk?'#2a1a00':'#c89020'

  const masts = cfg.masts
  const mH    = cfg.mastH
  const L     = cfg.L
  const W     = cfg.W
  const H     = cfg.H

  // mast x positions
  const mastXs = masts===1?[0.08]:
    masts===2?[-0.12,0.40]:
    [-0.52,0.08,0.58]

  return(
    <group ref={grp} position={[wx,0.06,wz]} rotation={[0,ry,0]} scale={[sc,sc,sc]}>

      {/* ── HULL ── */}
      <mesh castShadow position={[0,0,0]}>
        <boxGeometry args={[L,H,W]}/>
        <meshStandardMaterial color={hullC} roughness={0.78} metalness={0.12}/>
      </mesh>

      {/* Hull plank lines */}
      {[0,1,2,3,4].map(i=>(
        <mesh key={`pk${i}`} position={[0,-H/2+0.038+i*0.092,0]}>
          <boxGeometry args={[L*0.97,0.028,W+0.008]}/>
          <meshStandardMaterial color={isPlayer?'#0f1e38':'#150e04'} roughness={0.95} metalness={0.04}/>
        </mesh>
      ))}

      {/* Copper stripe on waterline */}
      <mesh position={[0,-H/2+0.018,0]}>
        <boxGeometry args={[L*0.98,0.025,W+0.012]}/>
        <meshStandardMaterial color={goldC} roughness={0.55} metalness={0.45}/>
      </mesh>

      {/* ── BOW (pointed) ── */}
      <mesh castShadow position={[L/2+cfg.bowLen*0.38,0,0]} rotation={[0,0,0]}>
        <cylinderGeometry args={[0,W/2.1,cfg.bowLen,6,1]}
          ref={el=>{ if(el) el.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI/2)) }}/>
        <meshStandardMaterial color={hullC} roughness={0.78}/>
      </mesh>

      {/* Bowsprit (diagonal spar at bow) */}
      {size>=2&&(
        <mesh position={[L/2+cfg.bowLen*0.3, H/2+0.08, 0]}
          rotation={[0,0,-Math.PI/8]}>
          <cylinderGeometry args={[0.018,0.028,cfg.bowLen*0.9,6]}/>
          <meshStandardMaterial color={mastC} roughness={0.85}/>
        </mesh>
      )}

      {/* ── STERN raised deck ── */}
      <mesh castShadow position={[-L/2+0.22+cfg.sternH, H/2+cfg.sternH/2, 0]}>
        <boxGeometry args={[0.44+size*0.06, cfg.sternH, W*0.82]}/>
        <meshStandardMaterial color={deckC} roughness={0.72}/>
      </mesh>

      {/* Galleon: double stern castle */}
      {size===4&&(
        <mesh position={[-L/2+0.16, H/2+cfg.sternH+0.10, 0]}>
          <boxGeometry args={[0.30,0.18,W*0.65]}/>
          <meshStandardMaterial color={deckC} roughness={0.72}/>
        </mesh>
      )}

      {/* Stern ornament */}
      <mesh position={[-L/2-0.04, H/2-0.06, 0]}>
        <boxGeometry args={[0.07,H*0.7,W*0.72]}/>
        <meshStandardMaterial color={size>=3?goldC:hullC} roughness={0.7} metalness={size>=3?0.4:0.1}/>
      </mesh>
      {size>=3&&(
        <mesh position={[-L/2-0.04, H/2+0.12, 0]}>
          <torusGeometry args={[0.09,0.018,6,14,Math.PI]}/>
          <meshStandardMaterial color={goldC} roughness={0.5} metalness={0.5}/>
        </mesh>
      )}

      {/* ── MAIN DECK ── */}
      <mesh castShadow position={[0,H/2+0.025,0]}>
        <boxGeometry args={[L-0.08,0.055,W-0.08]}/>
        <meshStandardMaterial color={deckC} roughness={0.72} metalness={0.04}/>
      </mesh>

      {/* Deck planks */}
      {Array.from({length:Math.floor(L/0.14)},(_,i)=>(
        <mesh key={`dp${i}`} position={[-L/2+0.10+i*0.14, H/2+0.055, 0]}>
          <boxGeometry args={[0.10,0.018,W-0.12]}/>
          <meshStandardMaterial color={isPlayer?'#0c1a2e':'#100c03'} roughness={0.9}/>
        </mesh>
      ))}

      {/* Railing posts */}
      {Array.from({length:Math.floor((L-0.2)/0.22)},(_,i)=>{
        const px=-L/2+0.16+i*0.22
        return(
          <group key={`rp${i}`}>
            <mesh position={[px,H/2+0.10,W/2-0.035]}>
              <cylinderGeometry args={[0.022,0.022,0.16,4]}/>
              <meshStandardMaterial color={mastC} roughness={0.9}/>
            </mesh>
            <mesh position={[px,H/2+0.10,-W/2+0.035]}>
              <cylinderGeometry args={[0.022,0.022,0.16,4]}/>
              <meshStandardMaterial color={mastC} roughness={0.9}/>
            </mesh>
          </group>
        )
      })}
      {/* Railing top bar */}
      <mesh position={[0,H/2+0.172,W/2-0.035]}>
        <boxGeometry args={[L-0.14,0.028,0.026]}/>
        <meshStandardMaterial color={mastC} roughness={0.9}/>
      </mesh>
      <mesh position={[0,H/2+0.172,-W/2+0.035]}>
        <boxGeometry args={[L-0.14,0.028,0.026]}/>
        <meshStandardMaterial color={mastC} roughness={0.9}/>
      </mesh>

      {/* Cargo barrels on deck */}
      {size>=3&&[[-0.15,0.06],[-0.15,-0.06],[0.05,0]].map(([bx,bz],i)=>(
        <mesh key={`br${i}`} position={[bx as number,H/2+0.07,bz as number]}>
          <cylinderGeometry args={[0.055,0.055,0.10,8]}/>
          <meshStandardMaterial color={'#3d2208'} roughness={0.9}/>
        </mesh>
      ))}

      {/* ── MASTS ── */}
      {mastXs.map((mstX,mi)=>{
        const mh = mi===0?mH : mH*(0.82-mi*0.07)
        const sw = cfg.sailW*(1-mi*0.1)
        const sh = mh*0.58
        const mRad = 0.042-mi*0.004
        return(
          <group key={`mast${mi}`}>
            {/* Mast pole */}
            <mesh castShadow position={[mstX,H/2+mh/2+0.04,0]}>
              <cylinderGeometry args={[mRad*0.78,mRad+0.006,mh,8]}/>
              <meshStandardMaterial color={mastC} roughness={0.86} metalness={0.1}/>
            </mesh>

            {/* Crow's nest */}
            {mi===0&&cfg.hasCrowsNest&&(
              <group position={[mstX,H/2+mh*0.72,0]}>
                <mesh>
                  <cylinderGeometry args={[0.14,0.10,0.11,10]}/>
                  <meshStandardMaterial color={deckC} roughness={0.8}/>
                </mesh>
                {/* Nest rim */}
                <mesh position={[0,0.06,0]}>
                  <torusGeometry args={[0.13,0.012,5,14]}/>
                  <meshStandardMaterial color={mastC} roughness={0.85}/>
                </mesh>
              </group>
            )}

            {/* Top cap */}
            <mesh position={[mstX,H/2+mh+0.04,0]}>
              <sphereGeometry args={[0.032,6,6]}/>
              <meshStandardMaterial color={mastC} roughness={0.8}/>
            </mesh>

            {/* Yardarm */}
            <mesh position={[mstX,H/2+mh*0.84,0]}
              rotation={[0,0,Math.PI/2]}>
              <cylinderGeometry args={[0.016,0.016,sw*1.9,6]}/>
              <meshStandardMaterial color={mastC} roughness={0.9}/>
            </mesh>

            {/* Lower yard (galleon/frigate) */}
            {size>=3&&(
              <mesh position={[mstX,H/2+mh*0.48,0]}
                rotation={[0,0,Math.PI/2]}>
                <cylinderGeometry args={[0.013,0.013,sw*1.4,6]}/>
                <meshStandardMaterial color={mastC} roughness={0.9}/>
              </mesh>
            )}

            {/* Main sail */}
            <mesh position={[mstX+0.02,H/2+mh*0.57,0.03]}>
              <planeGeometry args={[sw*1.65,sh,10,10]}/>
              <meshStandardMaterial color={sailC} side={THREE.DoubleSide}
                roughness={0.88} transparent opacity={sunk?0.25:0.97}/>
            </mesh>
            {/* Sail inner shadow */}
            <mesh position={[mstX,H/2+mh*0.57,-0.018]}>
              <planeGeometry args={[sw*1.52,sh*0.88,4,4]}/>
              <meshStandardMaterial
                color={isPlayer?'#b8d4ee':'#e0d4b8'}
                side={THREE.DoubleSide} roughness={0.95}
                transparent opacity={sunk?0.15:0.28}/>
            </mesh>

            {/* Topsail (frigate+) */}
            {size>=3&&(
              <mesh position={[mstX+0.015,H/2+mh*0.88,0.025]}>
                <planeGeometry args={[sw*0.95,sh*0.38,6,6]}/>
                <meshStandardMaterial color={sailC} side={THREE.DoubleSide}
                  roughness={0.88} transparent opacity={sunk?0.2:0.94}/>
              </mesh>
            )}

            {/* Rigging ropes (fore + aft) */}
            <mesh position={[mstX+L*0.26, H/2+mh*0.42, 0.02]}
              rotation={[0,0,Math.atan2(mh*0.42,L*0.26)]}>
              <cylinderGeometry args={[0.007,0.007,
                Math.sqrt((L*0.26)**2+(mh*0.42)**2),4]}/>
              <meshStandardMaterial color={ropeC} roughness={1}/>
            </mesh>
            <mesh position={[mstX-L*0.18, H/2+mh*0.38, 0.02]}
              rotation={[0,0,-Math.atan2(mh*0.38,L*0.18)]}>
              <cylinderGeometry args={[0.007,0.007,
                Math.sqrt((L*0.18)**2+(mh*0.38)**2),4]}/>
              <meshStandardMaterial color={ropeC} roughness={1}/>
            </mesh>
          </group>
        )
      })}

      {/* ── FLAGS ── */}
      {/* Pirate flag at main mast top */}
      <mesh position={[mastXs[0]+0.14,H/2+mH+0.22,0.01]}>
        <planeGeometry args={[0.30,0.20]}/>
        <meshStandardMaterial color={sunk?'#1a0000':'#060614'}
          side={THREE.DoubleSide} roughness={0.9}/>
      </mesh>
      <mesh position={[mastXs[0]+0.20,H/2+mH+0.22,0.025]}>
        <planeGeometry args={[0.12,0.08]}/>
        <meshStandardMaterial color={sunk?'#331100':'#f5f5dc'}
          side={THREE.DoubleSide} roughness={0.9} transparent opacity={0.75}/>
      </mesh>
      {/* Nation flag at stern mast (galleon) */}
      {size===4&&mastXs.length>=3&&(
        <mesh position={[mastXs[2]+0.12,H/2+mH*0.83+0.14,0.01]}>
          <planeGeometry args={[0.22,0.14]}/>
          <meshStandardMaterial color={isPlayer?'#001a6e':'#6e1a00'}
            side={THREE.DoubleSide} roughness={0.9}/>
        </mesh>
      )}

      {/* ── CANNONS ── */}
      {Array.from({length:cfg.cannons},(_,i)=>{
        const cx=-L/2+0.28+i*(L-0.36)/(Math.max(cfg.cannons-1,1))
        return(
          <group key={`cn${i}`}>
            {/* Barrel */}
            <mesh position={[cx,-0.04,W/2+0.05]} rotation={[Math.PI/2,0,0]}>
              <cylinderGeometry args={[0.048,0.058,0.30,8]}/>
              <meshStandardMaterial color={metalC} roughness={0.55} metalness={0.6}/>
            </mesh>
            {/* Muzzle ring */}
            <mesh position={[cx,-0.04,W/2+0.19]} rotation={[Math.PI/2,0,0]}>
              <torusGeometry args={[0.058,0.01,6,12]}/>
              <meshStandardMaterial color={goldC} roughness={0.5} metalness={0.5}/>
            </mesh>
            {/* Carriage */}
            <mesh position={[cx,-0.11,W/2+0.05]}>
              <boxGeometry args={[0.16,0.06,0.14]}/>
              <meshStandardMaterial color={'#3d2208'} roughness={0.9}/>
            </mesh>
            {/* Wheels */}
            {[-0.055,0.055].map((wz,wi)=>(
              <mesh key={wi} position={[cx,-0.13,W/2+0.05+wz]} rotation={[0,0,Math.PI/2]}>
                <torusGeometry args={[0.06,0.014,5,12]}/>
                <meshStandardMaterial color={'#7a5a0e'} roughness={0.85}/>
              </mesh>
            ))}
          </group>
        )
      })}

      {/* ── LANTERN at bow ── */}
      <mesh position={[L/2+0.08,H/2+0.22,0]}>
        <octahedronGeometry args={[0.06,0]}/>
        <meshStandardMaterial color={isPlayer?'#4488ff':'#ff9933'}
          emissive={isPlayer?'#2255cc':'#cc6600'} emissiveIntensity={sunk?0:0.9}
          roughness={0.3} metalness={0.4}/>
      </mesh>
      <pointLight
        position={[L/2+0.08,H/2+0.22,0]}
        intensity={sunk?0:0.8}
        color={isPlayer?'#4a90ff':'#ffaa44'}
        distance={3.2} decay={2}
      />

      {/* Stern lantern */}
      {size>=2&&(
        <>
          <mesh position={[-L/2-0.04,H/2+0.18,0]}>
            <octahedronGeometry args={[0.05,0]}/>
            <meshStandardMaterial color={'#ffcc44'}
              emissive={'#ff9900'} emissiveIntensity={sunk?0:0.7}
              roughness={0.3} metalness={0.4}/>
          </mesh>
          <pointLight
            position={[-L/2-0.04,H/2+0.18,0]}
            intensity={sunk?0:0.5}
            color={'#ffaa44'} distance={2.5} decay={2}
          />
        </>
      )}

      {/* Fire when sunk */}
      {sunk&&(
        <pointLight position={[0,0.6,0]} intensity={2.5}
          color="#ff3300" distance={3.5} decay={2}/>
      )}
    </group>
  )
}

/* ─── HIT / MISS VFX ─── */
const HitRing:React.FC<{wx:number;wz:number}>=({wx,wz})=>{
  const r1=useRef<THREE.Mesh>(null)
  const r2=useRef<THREE.Mesh>(null)
  useFrame(({clock})=>{
    const t=clock.getElapsedTime()
    if(r1.current){
      r1.current.rotation.z=t*2.2
      r1.current.scale.setScalar(0.85+Math.sin(t*6)*0.12)
    }
    if(r2.current){
      r2.current.rotation.z=-t*1.5
      r2.current.scale.setScalar(0.7+Math.sin(t*4+1)*0.10)
    }
  })
  return(
    <group position={[wx,0.12,wz]} rotation={[-Math.PI/2,0,0]}>
      <mesh ref={r1}>
        <ringGeometry args={[0.30,0.44,32]}/>
        <meshBasicMaterial color="#ff2200" transparent opacity={0.88} side={THREE.DoubleSide}/>
      </mesh>
      <mesh ref={r2}>
        <ringGeometry args={[0.18,0.28,24]}/>
        <meshBasicMaterial color="#ff8800" transparent opacity={0.7} side={THREE.DoubleSide}/>
      </mesh>
    </group>
  )
}
const MissRing:React.FC<{wx:number;wz:number}>=({wx,wz})=>{
  const ref=useRef<THREE.Mesh>(null)
  useFrame(({clock})=>{
    if(!ref.current)return
    const t=clock.getElapsedTime()
    ref.current.scale.setScalar(0.6+Math.sin(t*2.4)*0.08)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity=0.35+Math.sin(t*1.9)*0.15
  })
  return(
    <mesh ref={ref} position={[wx,0.08,wz]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[0.08,0.18,20]}/>
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.45} side={THREE.DoubleSide}/>
    </mesh>
  )
}

/* ─── BOARD ─── */
interface BoardProps{
  board:Board;ships:Ship[];boardZ:number
  isPlayer:boolean;interactive:boolean
  onClickCell?:(x:number,y:number)=>void
}
const Board3D:React.FC<BoardProps>=({board,ships,boardZ,isPlayer,interactive,onClickCell})=>{
  // ship is shown ONLY when fully sunk (fog-of-war for enemy)
  // player ships always shown
  const sunkIds=useMemo(()=>{
    const s=new Set<number>()
    ships.forEach(ship=>{ if(ship.hits>=ship.size) s.add(ship.id) })
    return s
  },[ships])

  return(
    <group position={[0,0,boardZ]}>
      {board.map((row,y)=>row.map((cell,x)=>{
        const wx=OFF+x*CELL; const wz=OFF+y*CELL
        return(
          <WaterTile key={`${x}-${y}`}
            gx={x} gy={y} wx={wx} wz={wz}
            hit={cell.hit} miss={cell.miss}
            interactive={interactive}
            onClickCell={onClickCell}/>
        )
      }))}
      {board.map((row,y)=>row.map((cell,x)=>{
        const wx=OFF+x*CELL; const wz=OFF+y*CELL
        if(cell.hit)  return <HitRing  key={`h${x}-${y}`} wx={wx} wz={wz}/>
        if(cell.miss) return <MissRing key={`m${x}-${y}`} wx={wx} wz={wz}/>
        return null
      }))}
      {ships.map(ship=>{
        const cx=ship.x+(ship.horizontal?(ship.size-1)/2:0)
        const cy=ship.y+(!ship.horizontal?(ship.size-1)/2:0)
        const wx=OFF+cx*CELL; const wz=OFF+cy*CELL
        // player: always visible; enemy: only when sunk
        const vis=isPlayer||sunkIds.has(ship.id)
        const sunk=sunkIds.has(ship.id)
        return(
          <PirateShip key={ship.id}
            wx={wx} wz={wz}
            size={ship.size} horizontal={ship.horizontal}
            visible={vis} sunk={sunk} isPlayer={isPlayer}/>
        )
      })}
    </group>
  )
}

/* ─── PARTICLES ─── */
const Particles:React.FC=()=>{
  const geom=useMemo(()=>{
    const g=new THREE.BufferGeometry()
    const n=300
    const pos=new Float32Array(n*3)
    for(let i=0;i<n;i++){
      pos[i*3]=(Math.random()-0.5)*50
      pos[i*3+1]=Math.random()*4+0.1
      pos[i*3+2]=Math.random()*(ENEMY_Z+BOARD+6)-6
    }
    g.setAttribute('position',new THREE.BufferAttribute(pos,3))
    return g
  },[])
  const mat=useRef<THREE.PointsMaterial>(null)
  useFrame(({clock})=>{
    if(mat.current) mat.current.opacity=0.12+Math.sin(clock.getElapsedTime()*0.3)*0.05
  })
  return(
    <points geometry={geom}>
      <pointsMaterial ref={mat} color="#bfdbfe" size={0.06}
        transparent opacity={0.15} sizeAttenuation/>
    </points>
  )
}

/* ─── CAMERA CONTROLLER (OrbitControls + auto-target on turn change) ─── */
interface CamCtrlProps { targetEnemy:boolean }
const CameraController:React.FC<CamCtrlProps>=({targetEnemy})=>{
  const {camera}=useThree()
  const orbitRef=useRef<any>(null)
  const animating=useRef(false)
  const animT=useRef(0)
  const fromPos=useRef(new THREE.Vector3())
  const toPos  =useRef(new THREE.Vector3())
  const fromTgt=useRef(new THREE.Vector3())
  const toTgt  =useRef(new THREE.Vector3())
  const prevTurn=useRef<boolean|null>(null)

  // closer initial camera: fov 56, y=10, z+11
  const getPreset=(enemy:boolean)=>({
    pos: new THREE.Vector3(0, 10, (enemy?ENEMY_Z:PLAYER_Z)+11),
    tgt: new THREE.Vector3(0,  0,  enemy?ENEMY_Z:PLAYER_Z),
  })

  useEffect(()=>{
    const p=getPreset(targetEnemy)
    camera.position.copy(p.pos)
    if(orbitRef.current){
      orbitRef.current.target.copy(p.tgt)
      orbitRef.current.update()
    }
  },[])

  useEffect(()=>{
    if(prevTurn.current===null){ prevTurn.current=targetEnemy; return }
    if(prevTurn.current===targetEnemy) return
    prevTurn.current=targetEnemy
    const p=getPreset(targetEnemy)
    fromPos.current.copy(camera.position)
    toPos.current.copy(p.pos)
    fromTgt.current.copy(orbitRef.current?.target??new THREE.Vector3(0,0,targetEnemy?ENEMY_Z:PLAYER_Z))
    toTgt.current.copy(p.tgt)
    animating.current=true
    animT.current=0
  },[targetEnemy])

  useFrame((_,delta)=>{
    if(!animating.current||!orbitRef.current)return
    animT.current=Math.min(animT.current+delta*1.1,1)
    const t=1-Math.pow(1-animT.current,3) // ease out cubic
    camera.position.lerpVectors(fromPos.current,toPos.current,t)
    orbitRef.current.target.lerpVectors(fromTgt.current,toTgt.current,t)
    orbitRef.current.update()
    if(animT.current>=1) animating.current=false
  })

  return(
    <OrbitControls
      ref={orbitRef}
      enableDamping dampingFactor={0.08}
      minDistance={3} maxDistance={35}
      maxPolarAngle={Math.PI/2.1}
      mouseButtons={{
        LEFT:  THREE.MOUSE.ROTATE,
        MIDDLE:THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  )
}

/* ─── INNER SCENE ─── */
interface InnerProps{
  playerBoard:Board;playerShips:Ship[]
  aiBoard:Board;aiShips:Ship[]
  playerTurn:boolean;gameOver:boolean
  onCellClick:(x:number,y:number)=>void
}
const InnerScene:React.FC<InnerProps>=({playerBoard,playerShips,aiBoard,aiShips,playerTurn,gameOver,onCellClick})=>{
  const {gl}=useThree()
  useEffect(()=>{
    gl.domElement.style.cursor=(playerTurn&&!gameOver)?'crosshair':'default'
  },[playerTurn,gameOver,gl])

  return(
    <>
      <color attach="background" args={['#010a1a']}/>
      <ambientLight intensity={0.35}/>
      <hemisphereLight args={['#1a3a6e','#0a0f1e',0.55]}/>
      <directionalLight position={[8,20,10]}  intensity={1.4} color="#c8deff" castShadow
        shadow-mapSize={[2048,2048]}/>
      <directionalLight position={[-5,10,-8]} intensity={0.5} color="#0a1a50"/>
      <pointLight position={[0,12,ENEMY_Z/2]} intensity={0.4} color="#1e3a8a"/>
      <spotLight position={[0,18,PLAYER_Z]} angle={0.45} penumbra={0.6}
        intensity={0.7} color="#3366ff" target-position={[0,0,PLAYER_Z]}/>
      <spotLight position={[0,18,ENEMY_Z]} angle={0.45} penumbra={0.6}
        intensity={0.7} color="#ff6633" target-position={[0,0,ENEMY_Z]}/>
      <fogExp2 attach="fog" color="#010a1a" density={0.018}/>

      <Ocean cz={PLAYER_Z}/>
      <Ocean cz={ENEMY_Z}/>
      <Particles/>
      <CameraController targetEnemy={playerTurn&&!gameOver}/>

      <Board3D board={playerBoard} ships={playerShips}
        boardZ={PLAYER_Z} isPlayer={true} interactive={false}/>
      <Board3D board={aiBoard} ships={aiShips}
        boardZ={ENEMY_Z} isPlayer={false}
        interactive={playerTurn&&!gameOver}
        onClickCell={onCellClick}/>
    </>
  )
}

/* ─── EXPORT ─── */
export interface ArenaProps{
  playerBoard:Board;playerShips:Ship[]
  aiBoard:Board;aiShips:Ship[]
  playerTurn:boolean;gameOver:boolean
  onCellClick:(x:number,y:number)=>void
}
export const Arena:React.FC<ArenaProps>=(props)=>(
  <Canvas shadows
    camera={{position:[0,10,11],fov:56,near:0.1,far:400}}
    gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}
    style={{width:'100%',height:'100%',display:'block'}}>
    <InnerScene {...props}/>
  </Canvas>
)
