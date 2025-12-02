import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls, Trail, Html } from '@react-three/drei'
import { RigidBody, interactionGroups } from '@react-three/rapier'
import * as THREE from 'three'
import useGameStore from '../store/useGameStore'

// 衝突グループ
const PLAYER_GROUP = 1
const MISSILE_GROUP = 2
const ENEMY_GROUP = 3

// --- ミサイル ---
const Missile = ({ startPos, startRot, targetId, robotVelocity, launchIndex }) => {
  const rigidBodyRef = useRef()
  const { scene } = useThree()
  const lifeTime = useRef(0)
  
  useEffect(() => {
    if (!rigidBodyRef.current) return;

    // 初速の計算
    const inertia = new THREE.Vector3(...robotVelocity)
    const euler = new THREE.Euler(...startRot)
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler)
    const up = new THREE.Vector3(0, 1, 0).applyEuler(euler)
    const right = new THREE.Vector3(1, 0, 0).applyEuler(euler)

    const spreadSide = (launchIndex % 2 === 0) ? 1 : -1
    const launchDir = new THREE.Vector3()
    
    // 上・横・前に拡散
    launchDir.add(forward.multiplyScalar(30)) 
    launchDir.add(up.multiplyScalar(10)) 
    launchDir.add(right.multiplyScalar(15 * spreadSide))
    
    // 慣性を乗せる
    const finalVelocity = launchDir.add(inertia)
    rigidBodyRef.current.setLinvel(finalVelocity, true)
  }, [])

  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return
    lifeTime.current += delta

    // 0.3秒後から誘導開始
    if (targetId && lifeTime.current > 0.3) {
        const enemyObj = scene.getObjectByName(`enemy-${targetId}`)
        if (enemyObj) {
            const targetPos = enemyObj.getWorldPosition(new THREE.Vector3())
            
            // Rapierの座標をThree.jsのVector3に変換
            const rPos = rigidBodyRef.current.translation()
            const currentPos = new THREE.Vector3(rPos.x, rPos.y, rPos.z)
            
            const dirToTarget = targetPos.clone().sub(currentPos).normalize()
            const currentVel = rigidBodyRef.current.linvel()
            const velocityVec = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z)
            
            // 誘導 (係数0.15)
            velocityVec.lerp(dirToTarget.multiplyScalar(80), 0.15) 
            rigidBodyRef.current.setLinvel(velocityVec, true)

            // 向き調整
            const lookAtTarget = currentPos.clone().add(velocityVec)
            const lookAtMatrix = new THREE.Matrix4().lookAt(currentPos, lookAtTarget, new THREE.Vector3(0,1,0))
            const quaternion = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix)
            rigidBodyRef.current.setRotation(quaternion, true)
        }
    }
  })

  return (
    <RigidBody 
        ref={rigidBodyRef} 
        position={startPos} 
        rotation={startRot} 
        colliders="ball" 
        gravityScale={0} 
        name="bullet" 
        sensor 
        ccd
        // 衝突グループ: ミサイル(2) は 地面(0)と敵(3)にのみ当たる
        collisionGroups={interactionGroups(MISSILE_GROUP, [0, ENEMY_GROUP])}
    >
      <group>
          <mesh>
             <boxGeometry args={[0.5, 0.5, 2]} /> 
             <meshStandardMaterial color="orange" emissive="red" emissiveIntensity={3} />
          </mesh>
          <Trail width={3} length={12} color="white" attenuation={(t) => t}>
             <mesh visible={false} />
          </Trail>
      </group>
    </RigidBody>
  )
}

// --- ロボット ---
export const Robot = ({ position = [0, 5, 0], color = "orange" }) => {
  const rigidBodyRef = useRef()
  const meshRef = useRef()
  const markerRef = useRef() 
  const muzzleRef = useRef() 

  const [, getKeys] = useKeyboardControls()
  const [missiles, setMissiles] = useState([])
  const { consumeEnergy, recoverEnergy, enemies, takeDamage } = useGameStore()
  const { camera, scene } = useThree() 

  const jumpPressedDuration = useRef(0)
  const [lockTargetId, setLockTargetId] = useState(null)
  const [lockStatus, setLockStatus] = useState('searching') 
  const [lockProgress, setLockProgress] = useState(0)
  const lockTimer = useRef(0) 
  const lastFiredTime = useRef(0)
  
  const LOCK_REQUIRED_TIME = 0.5 
  const FIRE_RATE = 200 

  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return

    const { forward, backward, left, right, jump, boost } = getKeys()
    const linvel = rigidBodyRef.current.linvel()
    
    // 座標変換 (ここが重要)
    const rPos = rigidBodyRef.current.translation()
    const currentPos = new THREE.Vector3(rPos.x, rPos.y, rPos.z)
    
    const isGrounded = Math.abs(linvel.y) < 0.5 
    const now = Date.now()

    if (isGrounded && !boost) recoverEnergy()

    // 1. ロックオン計算
    let bestTarget = null
    let minDistToCenter = Infinity
    const screenCenter = new THREE.Vector2(0, 0)
    
    const enemyList = enemies || []
    enemyList.forEach(enemy => {
      const enemyObj = scene.getObjectByName(`enemy-${enemy.id}`)
      if (enemyObj) {
          const realPos = enemyObj.getWorldPosition(new THREE.Vector3())
          const screenPos = realPos.clone().project(camera)
          
          if (screenPos.z < 1 && Math.abs(screenPos.x) < 0.5 && Math.abs(screenPos.y) < 0.5) {
            const dist = screenCenter.distanceTo(new THREE.Vector2(screenPos.x, screenPos.y))
            if (dist < 0.4 && dist < minDistToCenter) {
              minDistToCenter = dist
              bestTarget = enemy 
            }
          }
      }
    })

    if (bestTarget) {
      if (lockTargetId === bestTarget.id) {
        if (lockStatus !== 'locked') {
            lockTimer.current += delta
            setLockProgress(Math.min(lockTimer.current / LOCK_REQUIRED_TIME, 1.0))
            if (lockTimer.current >= LOCK_REQUIRED_TIME) setLockStatus('locked')
            else setLockStatus('locking')
        }
      } else {
        setLockTargetId(bestTarget.id)
        lockTimer.current = 0
        setLockProgress(0)
        setLockStatus('locking')
      }
    } else {
      setLockTargetId(null)
      lockTimer.current = 0
      setLockProgress(0)
      setLockStatus('searching')
    }

    // マーカー更新
    if (lockTargetId && markerRef.current) {
        const enemyObj = scene.getObjectByName(`enemy-${lockTargetId}`)
        if (enemyObj) {
            markerRef.current.position.copy(enemyObj.getWorldPosition(new THREE.Vector3()))
        }
    }

    // 2. ミサイル発射
    if (lockStatus === 'locked' && lockTargetId && (now - lastFiredTime.current > FIRE_RATE)) {
       lastFiredTime.current = now
       
       // マズル位置取得
       const muzzlePos = new THREE.Vector3()
       if (muzzleRef.current) {
           muzzleRef.current.getWorldPosition(muzzlePos)
       } else {
           muzzlePos.copy(currentPos)
       }

       const currentRotY = meshRef.current ? meshRef.current.rotation.y : 0
       const robotVel = [linvel.x, linvel.y, linvel.z]
       
       setMissiles(prev => [
         ...prev, 
         {
           id: now, 
           startPos: [muzzlePos.x, muzzlePos.y, muzzlePos.z], 
           startRot: [0, currentRotY, 0],
           targetId: lockTargetId,
           robotVelocity: robotVel,
           launchIndex: prev.length
         }
       ])

       setTimeout(() => setMissiles(p => p.filter(b => b.id !== now)), 4000)
    }

    // 3. 移動制御
    if (jump) jumpPressedDuration.current += delta
    else jumpPressedDuration.current = 0
    const moveDir = new THREE.Vector3()
    if (forward) moveDir.z -= 1
    if (backward) moveDir.z += 1
    if (left) moveDir.x -= 1
    if (right) moveDir.x += 1
    if (moveDir.length() > 0) moveDir.normalize()
    
    let speed = 8 
    if (boost && consumeEnergy(0.3)) speed = 30 
    
    const targetX = moveDir.x * speed
    const targetZ = moveDir.z * speed
    let targetY = linvel.y 
    const MAX_HEIGHT = 40 
    const JUMP_IGNITION_TIME = 0.2
    
    if (jumpPressedDuration.current > JUMP_IGNITION_TIME && consumeEnergy(0.05) && currentPos.y < MAX_HEIGHT) {
       targetY = 8 
    }
    
    rigidBodyRef.current.setLinvel({ x: targetX, y: targetY, z: targetZ }, true)

    // 旋回
    if (moveDir.length() > 0 && meshRef.current) {
      const targetRotation = Math.atan2(moveDir.x, moveDir.z) + Math.PI
      let rotDiff = targetRotation - meshRef.current.rotation.y
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      meshRef.current.rotation.y += rotDiff * 0.1
    }

    // 4. カメラ制御 (★ここを修正しました)
    // 以前 bodyPos と書いていた箇所を currentPos に修正
    let targetLookAt = new THREE.Vector3(currentPos.x, currentPos.y + 3, currentPos.z)
    
    if (lockTargetId) {
        const enemyObj = scene.getObjectByName(`enemy-${lockTargetId}`)
        if (enemyObj) {
            targetLookAt.lerp(enemyObj.getWorldPosition(new THREE.Vector3()), 0.3) 
        }
    }
    const cameraOffset = new THREE.Vector3(0, 8, 20)
    if (boost) cameraOffset.z += 5
    
    state.camera.position.lerp(currentPos.clone().add(cameraOffset), 0.1) 
    state.camera.lookAt(targetLookAt)
  })

  return (
    <>
      <RigidBody 
        ref={rigidBodyRef} 
        position={position} 
        lockRotations 
        colliders="cuboid" 
        friction={0} 
        mass={5} 
        name="player"
        collisionGroups={interactionGroups(PLAYER_GROUP, [0, ENEMY_GROUP])}
        onIntersectionEnter={({ other }) => {
            if (other.rigidBodyObject?.name === 'enemy-bullet') {
                takeDamage(100)
            }
        }}
      >
        <group ref={meshRef}>
           <Trail width={3} length={4} color="cyan" attenuation={(t) => t * t}>
             <mesh position={[0, 1.5, 0]}>
               <boxGeometry args={[1.5, 3, 1.5]} />
               <meshStandardMaterial color={color} />
             </mesh>
           </Trail>
           <mesh position={[0, 3.5, 0]}>
             <boxGeometry args={[0.8, 0.8, 0.8]} />
             <meshStandardMaterial color="white" />
           </mesh>
           
           {/* マズル（銃口） */}
           <group ref={muzzleRef} position={[0, 2, 3]}>
              <mesh visible={false}><sphereGeometry args={[0.1]} /><meshBasicMaterial color="red" /></mesh>
           </group>
        </group>
      </RigidBody>
      
      {/* ロックサイト */}
      {lockTargetId && (
        <group ref={markerRef}>
          <Html center zIndexRange={[100, 0]}>
            <div style={{ position: 'relative', width: '100px', height: '100px', display:'flex', justifyContent:'center', alignItems:'center' }}>
                <div style={{
                    position: 'absolute',
                    width: lockStatus === 'locked' ? '60px' : '100px', 
                    height: lockStatus === 'locked' ? '60px' : '100px',
                    border: `2px dashed ${lockStatus === 'locked' ? 'red' : 'lime'}`,
                    borderRadius: '50%',
                    animation: 'spin 4s linear infinite',
                    transition: 'all 0.2s ease-out'
                }} />
                 <div style={{
                    position: 'absolute',
                    width: `${lockProgress * 100}%`,
                    height: '4px',
                    background: lockStatus === 'locked' ? 'red' : 'yellow',
                    bottom: '-10px',
                    transition: 'width 0.1s linear'
                }} />
            </div>
          </Html>
        </group>
      )}

      {missiles.map(b => <Missile key={b.id} {...b} />)}
    </>
  )
}