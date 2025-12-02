import { create } from 'zustand'

const useGameStore = create((set, get) => ({
  hp: 1000,
  energy: 100,
  maxEnergy: 100,
  score: 0,
  // 敵の初期設定 (HP100)
  enemies: [{ id: 1, hp: 100, position: [0, 5, -30] }],

  // エネルギー消費
  consumeEnergy: (amount) => {
    const current = get().energy
    if (current >= amount) {
      set({ energy: current - amount })
      return true
    }
    return false
  },

  // エネルギー回復
  recoverEnergy: () => set((state) => ({ 
    energy: Math.min(state.energy + 0.5, state.maxEnergy) 
  })),

  // プレイヤーの被ダメージ
  takeDamage: (amount) => set((state) => ({
    hp: state.hp - amount > 0 ? state.hp - amount : 0
  })),

  // 敵へのダメージ＆撃破・リスポーン処理
  damageEnemy: (id, amount) => {
    const state = get()
    const updatedEnemies = state.enemies.map(e => {
      if (e.id === id) return { ...e, hp: e.hp - amount }
      return e
    }).filter(e => e.hp > 0)
    
    let newScore = state.score
    
    // 敵が減っていたら（倒したら）スコア加算＆補充
    if (updatedEnemies.length < state.enemies.length) {
      newScore += 1000
      
      // 新しい敵をランダムな位置に補充
      const randomX = (Math.random() - 0.5) * 60
      const randomZ = -20 - Math.random() * 40
      updatedEnemies.push({ 
        id: Date.now(), 
        hp: 100, 
        position: [randomX, 5, randomZ] 
      })
    }

    set({ enemies: updatedEnemies, score: newScore })
  }
}))

export default useGameStore