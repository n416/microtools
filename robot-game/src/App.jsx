import { Canvas, useFrame } from '@react-three/fiber'
import { KeyboardControls, Sky, Grid, Stars, Html } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier'
import { Robot } from './components/Robot'
import useGameStore from './store/useGameStore'
import { useRef, useState, useEffect } from 'react'
import * as THREE from 'three'

// 衝突グループ (Robot.jsxと同じ定義)
const PLAYER_GROUP = 1
const MISSILE_GROUP = 2
const ENEMY_GROUP = 3

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'boost', keys: ['Shift'] },
]

// 敵の弾丸
const EnemyBullet = ({ position, direction }) => {
  const ref = useRef()
  useFrame(() => {
    if(ref.current) {
        const vel = new THREE.Vector3(...direction).multiplyScalar(40)
        ref.current.setLinvel(vel, true)
    }
  })
  return (
    <RigidBody 
      ref={ref} 
      position={position} 
      sensor 
      colliders="ball" 
      name="enemy-bullet"
      // 弾丸はプレイヤー(1)と地面(0)に当たる
      collisionGroups={interactionGroups(ENEMY_GROUP, [0, PLAYER_GROUP])}
    >
      <mesh>
        <sphereGeometry args={[0.8]} />
        <meshStandardMaterial color="purple" emissive="purple" emissiveIntensity={2} />
      </mesh>
    </RigidBody>
  )
}

// 敵AI
const SmartEnemy = ({ id, position: initialPos, hp }) => {
  const rigidBodyRef = useRef()
  const damageEnemy = useGameStore(s => s.damageEnemy)
  const [bullets, setBullets] = useState([])
  const lastShot = useRef(0)

  useFrame((state) => {
    if (!rigidBodyRef.current) return

    const playerPos = state.camera.position
    const targetX = playerPos.x
    const targetZ = playerPos.z - 10 

    const currentPos = rigidBodyRef.current.translation()
    const dirToPlayer = new THREE.Vector3(targetX - currentPos.x, 0, targetZ - currentPos.z).normalize()

    // 移動
    const speed = 8 
    rigidBodyRef.current.setLinvel({ 
        x: dirToPlayer.x * speed, 
        y: rigidBodyRef.current.linvel().y, 
        z: dirToPlayer.z * speed 
    }, true)

    // 攻撃
    const now = Date.now()
    if (now - lastShot.current > 1500) {
        lastShot.current = now
        setBullets(prev => [...prev, { 
            id: now, 
            position: [currentPos.x, currentPos.y + 1, currentPos.z],
            direction: [dirToPlayer.x, 0, dirToPlayer.z]
        }])
        setTimeout(() => setBullets(p => p.filter(b => b.id !== now)), 3000)
    }
  })

  return (
    <>
      <RigidBody 
        ref={rigidBodyRef} 
        position={initialPos} 
        colliders="cuboid" 
        name={`enemy-${id}`} 
        lockRotations 
        mass={10}
        // 敵(3)は、地面(0)、プレイヤー(1)、ミサイル(2) すべてと衝突する
        collisionGroups={interactionGroups(ENEMY_GROUP, [0, PLAYER_GROUP, MISSILE_GROUP])}
      >
        <mesh>
          <boxGeometry args={[3, 5, 3]} />
          <meshStandardMaterial color={`rgb(${255 * (hp/100)}, 0, 0)`} />
        </mesh>
        
        <Html position={[0, 4, 0]} center>
            <div style={{ width: '60px', height: '6px', background: 'gray', border: '1px solid white' }}>
                <div style={{ width: `${(hp / 100) * 100}%`, height: '100%', background: hp < 30 ? 'yellow' : 'red', transition: 'width 0.2s' }} />
            </div>
        </Html>

        <CuboidCollider 
          args={[1.6, 2.6, 1.6]} 
          sensor 
          // センサーも敵グループとして扱う
          collisionGroups={interactionGroups(ENEMY_GROUP, [MISSILE_GROUP])}
          onIntersectionEnter={({ other }) => {
            if (other.rigidBodyObject?.name === 'bullet') {
               damageEnemy(id, 2)
            }
          }} 
        />
      </RigidBody>
      
      {bullets.map(b => <EnemyBullet key={b.id} {...b} />)}
    </>
  )
}

export default function App() {
  const { hp, energy, maxEnergy, score, enemies } = useGameStore()
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    if (hp <= 0) setGameOver(true)
  }, [hp])

  return (
    <>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, fontFamily: 'Impact, sans-serif', color: hp < 300 ? 'red' : '#0f0', textShadow: '0 0 5px black' }}>
        <div style={{ fontSize: '24px' }}>SCORE: {score}</div>
        <div style={{ fontSize: '24px' }}>ARMOR: {hp} / 1000</div>
        <div style={{ marginTop: '10px', border: '2px solid white', width: '200px', height: '20px', background:'rgba(0,0,0,0.5)' }}>
          <div style={{ width: `${(energy / maxEnergy) * 100}%`, height: '100%', background: energy < 30 ? 'red' : 'cyan', transition: 'width 0.1s' }} />
        </div>
        <div style={{ fontSize: '12px', color:'cyan' }}>BOOST GAUGE</div>
      </div>

      {gameOver && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', fontSize: '100px', fontWeight:'bold', zIndex: 100, textShadow: '0 0 20px black' }}>
            GAME OVER
            <div style={{ fontSize: '30px', color:'white', textAlign:'center' }}>Refresh to Retry</div>
        </div>
      )}

      <KeyboardControls map={keyboardMap}>
        <Canvas shadows camera={{ fov: 60 }}>
          <color attach="background" args={['#050510']} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 20, 10]} intensity={2000} castShadow />

          {/* デバッグ表示が必要な場合は <Physics debug ...> にしてください */}
          <Physics gravity={[0, -30, 0]}>
            
            <Robot position={[0, 5, 0]} color="#4466ff" />

            {enemies.map(e => <SmartEnemy key={e.id} {...e} />)}

            <RigidBody 
              type="fixed" 
              friction={2} 
              // 床(0)は全員[1,2,3]と衝突する
              collisionGroups={interactionGroups(0, [PLAYER_GROUP, MISSILE_GROUP, ENEMY_GROUP])}
            >
               <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color="#222" />
               </mesh>
            </RigidBody>

          </Physics>
          
          <Grid position={[0, 0.05, 0]} args={[200, 200]} cellColor="#444" sectionColor="#0f0" fadeDistance={60} />
        </Canvas>
      </KeyboardControls>
    </>
  )
}