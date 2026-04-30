import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// CORSの設定
app.use('/*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'PUT', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Room-Password', 'X-Owner-Token'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))

// パスワードのハッシュ化 (SHA-256)
async function hashPassword(password) {
  if (!password) return null
  const msgUint8 = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 認証チェック
async function verifyPassword(db, roomId, providedPassword) {
  const row = await db.prepare('SELECT password_hash FROM RoomState WHERE room_id = ?').bind(roomId).first()
  if (!row) return { error: 'Room not found', status: 404 }
  if (!row.password_hash) return { valid: true } // パスワードなし

  const providedHash = await hashPassword(providedPassword)
  if (providedHash !== row.password_hash) {
    return { error: 'Unauthorized', status: 401 }
  }
  return { valid: true }
}

// ランダムなID生成（8文字）
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// [POST] ルーム作成
app.post('/api/rooms', async (c) => {
  const body = await c.req.json()
  const password = body.password || null
  const stateJson = body.state_json || '{}'
  
  const roomId = generateRoomId()
  const passwordHash = await hashPassword(password)
  const ownerToken = crypto.randomUUID()

  await c.env.DB.prepare(
    'INSERT INTO RoomState (room_id, password_hash, owner_token, state_json) VALUES (?, ?, ?, ?)'
  ).bind(roomId, passwordHash, ownerToken, stateJson).run()

  return c.json({ room_id: roomId, owner_token: ownerToken })
})

// [GET] ルーム情報取得
app.get('/api/rooms/:room_id', async (c) => {
  const roomId = c.req.param('room_id')
  const password = c.req.header('X-Room-Password') || c.req.query('password') || ''

  const auth = await verifyPassword(c.env.DB, roomId, password)
  if (auth.error) return c.json({ error: auth.error }, auth.status)

  const row = await c.env.DB.prepare('SELECT state_json, updated_at FROM RoomState WHERE room_id = ?').bind(roomId).first()
  return c.json({ state_json: row.state_json, updated_at: row.updated_at })
})

// [PUT] ルーム情報更新（マージ処理）
app.put('/api/rooms/:room_id', async (c) => {
  const roomId = c.req.param('room_id')
  const password = c.req.header('X-Room-Password') || ''

  const auth = await verifyPassword(c.env.DB, roomId, password)
  if (auth.error) return c.json({ error: auth.error }, auth.status)

  const body = await c.req.json()
  let incomingState = {}
  try {
    incomingState = JSON.parse(body.state_json || '{}')
  } catch (e) {
    return c.json({ error: 'Invalid state_json format' }, 400)
  }

  // 現在のDBのステートを取得
  const row = await c.env.DB.prepare('SELECT state_json FROM RoomState WHERE room_id = ?').bind(roomId).first()
  if (!row) return c.json({ error: 'Room not found' }, 404)

  let currentState = {}
  try {
    currentState = JSON.parse(row.state_json || '{}')
  } catch (e) {
    currentState = {}
  }

  // --- マージ処理 ---
  const mergedState = {
    logs: currentState.logs || [],
    timeDisplays: { ...currentState.timeDisplays },
    channelCounts: { ...currentState.channelCounts },
    disabledChannels: { ...currentState.disabledChannels },
    timestamps: {
      timeDisplays: { ...(currentState.timestamps?.timeDisplays || {}) },
      channelCounts: { ...(currentState.timestamps?.channelCounts || {}) },
      disabledChannels: { ...(currentState.timestamps?.disabledChannels || {}) },
      logs: Math.max(currentState.timestamps?.logs || 0, incomingState.timestamps?.logs || 0)
    }
  }

  const incomingTs = incomingState.timestamps || {}

  // 1. timeDisplaysのマージ
  for (const [key, value] of Object.entries(incomingState.timeDisplays || {})) {
    const curTs = mergedState.timestamps.timeDisplays[key] || 0
    const inTs = incomingTs.timeDisplays?.[key] || 0
    if (inTs >= curTs) {
      mergedState.timeDisplays[key] = value
      mergedState.timestamps.timeDisplays[key] = inTs
    }
  }
  for (const [key, ts] of Object.entries(incomingTs.timeDisplays || {})) {
    if (ts > (mergedState.timestamps.timeDisplays[key] || 0) && !incomingState.timeDisplays?.[key]) {
      delete mergedState.timeDisplays[key]
      mergedState.timestamps.timeDisplays[key] = ts
    }
  }

  // 2. channelCountsのマージ
  for (const [key, value] of Object.entries(incomingState.channelCounts || {})) {
    const curTs = mergedState.timestamps.channelCounts[key] || 0
    const inTs = incomingTs.channelCounts?.[key] || 0
    if (inTs >= curTs) {
      mergedState.channelCounts[key] = value
      mergedState.timestamps.channelCounts[key] = inTs
    }
  }

  // 3. disabledChannelsのマージ
  for (const [key, value] of Object.entries(incomingState.disabledChannels || {})) {
    const curTs = mergedState.timestamps.disabledChannels[key] || 0
    const inTs = incomingTs.disabledChannels?.[key] || 0
    if (inTs >= curTs) {
      mergedState.disabledChannels[key] = value
      mergedState.timestamps.disabledChannels[key] = inTs
    }
  }
  for (const [key, ts] of Object.entries(incomingTs.disabledChannels || {})) {
    if (ts > (mergedState.timestamps.disabledChannels[key] || 0) && !incomingState.disabledChannels?.[key]) {
      delete mergedState.disabledChannels[key]
      mergedState.timestamps.disabledChannels[key] = ts
    }
  }

  // 4. logsのマージ（重複排除のUnion）
  const logSet = new Set(mergedState.logs)
  for (const log of (incomingState.logs || [])) {
    logSet.add(log)
  }
  mergedState.logs = Array.from(logSet)

  const mergedStateStr = JSON.stringify(mergedState)

  await c.env.DB.prepare(
    'UPDATE RoomState SET state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?'
  ).bind(mergedStateStr, roomId).run()

  return c.json({ success: true, merged_state: mergedStateStr })
})

// [PATCH] パスワード変更
app.patch('/api/rooms/:room_id/password', async (c) => {
  const roomId = c.req.param('room_id')
  const ownerToken = c.req.header('X-Owner-Token')
  const body = await c.req.json()
  const newPassword = body.new_password || null

  const row = await c.env.DB.prepare('SELECT owner_token FROM RoomState WHERE room_id = ?').bind(roomId).first()
  if (!row) return c.json({ error: 'Room not found' }, 404)
  if (!ownerToken || row.owner_token !== ownerToken) {
    return c.json({ error: 'Unauthorized: Only the room owner can change the password' }, 401)
  }

  const newPasswordHash = await hashPassword(newPassword)

  await c.env.DB.prepare(
    'UPDATE RoomState SET password_hash = ? WHERE room_id = ?'
  ).bind(newPasswordHash, roomId).run()

  return c.json({ success: true })
})

export default app
