import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import type { Board, Ship } from '../game/types'
import { OceanPlane, HullFoam } from './Water'
import { FireParticles, MissSplash, SinkVFX } from './VFX'
import { PirateShip } from './Ships'

/* ─── CONSTANTS ─── */
const CELL    = 1.1
const BOARD   = 10 * CELL
const OFF     = -BOARD / 2 + CELL / 2
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
  float spec=pow(max(0.0,vElev*8.0),3.0)*0.18;
  col+=spec;
  float ex=smoothstep(0.45,0.5,abs(vUv.x-0.5)*2.0);
  float ey=smoothstep(0.45,0.5,abs(vUv.y-0.5)*2.0);
  float edge=max(ex,ey);
  vec3 eCol=mix(vec3(0.08,0.25,0.75),vec3(0.9,0.82,0.12),uHover);
  col=mix(col,eCol,edge*(0.22+uHover*0.38));
  col=mix(col,vec3(0.92,0.88,0.14),uHover*0.22*(1.0-d));
  float hf=(1.0-d)*uHit;
  col=mix(col,vec3(1.0,0.18,0.02)*(abs(sin(uTime*22.0))*0.4+0.6),hf*0.96);
  col+=vec3(1.0,0.5,0.0)*smoothstep(0.7,0.1,d)*uHit*0.5*(sin(uTime*28.0)*0.35+0.65);
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
const WaterTile: React.FC<TileProps> = React.memo(({gx,gy,wx,wz,hit,miss,interactive,onClickCell})=>{
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
})

/* ─── HIT / MISS VFX ─── */
const HitRing: React.FC<{wx:number;wz:number}> = React.memo(({wx,wz})=>{
  const r1=useRef<THREE.Mesh>(null)
  const r2=useRef<THREE.Mesh>(null)
  useFrame(({clock})=>{
    const t=clock.getElapsedTime()
    if(r1.current){r1.current.rotation.z=t*2.2;r1.current.scale.setScalar(0.85+Math.sin(t*6)*0.12)}
    if(r2.current){r2.current.rotation.z=-t*1.5;r2.current.scale.setScalar(0.7+Math.sin(t*4+1)*0.10)}
  })
  return(
    <group position={[wx,0.12,wz]} rotation={[-Math.PI/2,0,0]}>
      <mesh ref={r1}><ringGeometry args={[0.30,0.44,32]}/><meshBasicMaterial color="#ff2200" transparent opacity={0.88} side={THREE.DoubleSide}/></mesh>
      <mesh ref={r2}><ringGeometry args={[0.18,0.28,24]}/><meshBasicMaterial color="#ff8800" transparent opacity={0.7} side={THREE.DoubleSide}/></mesh>
    </group>
  )
})

/* ─── BOARD ─── */
interface BoardProps{
  board:Board;ships:Ship[];boardZ:number
  isPlayer:boolean;interactive:boolean
  onClickCell?:(x:number,y:number)=>void
}
const Board3D: React.FC<BoardProps> = React.memo(({board,ships,boardZ,isPlayer,interactive,onClickCell})=>{
  const sunkIds=useMemo(()=>{
    const s=new Set<number>();ships.forEach(ship=>{ if(ship.hits>=ship.size) s.add(ship.id) });return s
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
        if(cell.hit) return (
          <group key={`h${x}-${y}`}>
            <HitRing wx={wx} wz={wz}/>
            <FireParticles position={[wx, 0.15, wz]} active={true}/>
          </group>
        )
        if(cell.miss) return <MissSplash key={`m${x}-${y}`} position={[wx, 0.05, wz]}/>
        return null
      }))}
      {ships.map(ship=>{
        const cx=ship.x+(ship.horizontal?(ship.size-1)/2:0)
        const cy=ship.y+(!ship.horizontal?(ship.size-1)/2:0)
        const wx=OFF+cx*CELL; const wz=OFF+cy*CELL
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
})

/* ─── PARTICLES ─── */
const Particles: React.FC = React.memo(()=>{
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
      <pointsMaterial ref={mat} color="#bfdbfe" size={0.06} transparent opacity={0.15} sizeAttenuation/>
    </points>
  )
})

/* ─── CAMERA CONTROLLER ─── */
interface CamCtrlProps { targetEnemy:boolean }
const CameraController: React.FC<CamCtrlProps> = ({targetEnemy})=>{
  const {camera}=useThree()
  const orbitRef=useRef<any>(null)
  const animating=useRef(false)
  const animT=useRef(0)
  const fromPos=useRef(new THREE.Vector3())
  const toPos  =useRef(new THREE.Vector3())
  const fromTgt=useRef(new THREE.Vector3())
  const toTgt  =useRef(new THREE.Vector3())
  const prevTurn=useRef<boolean|null>(null)

  const getPreset=(enemy:boolean)=>({
    pos: new THREE.Vector3(0, 10, (enemy?ENEMY_Z:PLAYER_Z)+11),
    tgt: new THREE.Vector3(0,  0,  enemy?ENEMY_Z:PLAYER_Z),
  })

  useEffect(()=>{
    const p=getPreset(targetEnemy)
    camera.position.copy(p.pos)
    if(orbitRef.current){orbitRef.current.target.copy(p.tgt);orbitRef.current.update()}
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
    const t=1-Math.pow(1-animT.current,3)
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
const InnerScene: React.FC<InnerProps> = ({playerBoard,playerShips,aiBoard,aiShips,playerTurn,gameOver,onCellClick})=>{
  const {gl}=useThree()
  useEffect(()=>{
    gl.domElement.style.cursor=(playerTurn&&!gameOver)?'crosshair':'default'
  },[playerTurn,gameOver,gl])

  return(
    <>
      <color attach="background" args={['#010a1a']}/>

      <ambientLight intensity={0.18}/>
      <hemisphereLight args={['#1a3566', '#040c1e', 0.65]}/>
      <pointLight position={[12, 28, ENEMY_Z / 2]} intensity={3.5} color="#c8d8ff" distance={120} decay={1.2}/>
      <pointLight position={[-10, 18, PLAYER_Z]} intensity={0.8} color="#8ab0dd" distance={80} decay={2}/>
      <spotLight position={[0,18,ENEMY_Z]} angle={0.45} penumbra={0.7} intensity={0.5} color="#ff6633" target-position={[0,0,ENEMY_Z]}/>
      <spotLight position={[0,18,PLAYER_Z]} angle={0.45} penumbra={0.7} intensity={0.4} color="#3366ff" target-position={[0,0,PLAYER_Z]}/>

      <fogExp2 attach="fog" color="#010c20" density={0.026}/>

      <Stars radius={90} depth={50} count={4000} factor={4} saturation={0.4} fade speed={0.6}/>

      <OceanPlane centerZ={PLAYER_Z} />
      <OceanPlane centerZ={ENEMY_Z} />

      <Particles/>
      <CameraController targetEnemy={playerTurn&&!gameOver}/>

      <Board3D board={playerBoard} ships={playerShips}
        boardZ={PLAYER_Z} isPlayer={true} interactive={false}/>
      <Board3D board={aiBoard} ships={aiShips}
        boardZ={ENEMY_Z} isPlayer={false}
        interactive={playerTurn&&!gameOver}
        onClickCell={onCellClick}/>

      <EffectComposer multisampling={4}>
        <Bloom intensity={1.4} luminanceThreshold={0.28} luminanceSmoothing={0.82}
          kernelSize={KernelSize.LARGE} mipmapBlur/>
        <Vignette offset={0.42} darkness={0.72} blendFunction={BlendFunction.NORMAL}/>
      </EffectComposer>
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
export const Arena: React.FC<ArenaProps> = (props)=>(
  <Canvas shadows
    camera={{position:[0,10,11],fov:56,near:0.1,far:400}}
    gl={{antialias:true,alpha:false,powerPreference:'high-performance',
         toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1}}
    style={{width:'100%',height:'100%',display:'block'}}>
    <InnerScene {...props}/>
  </Canvas>
)
