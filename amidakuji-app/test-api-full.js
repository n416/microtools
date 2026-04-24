const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:8787/api';
const GROUP_ID = '8dd71aa5-48a8-44a8-b2e9-b273be1f3dcc';

async function runFullTests() {
  console.log("=== API Full Integration Tests ===");
  let passed = 0;
  let failed = 0;
  const testUserName = "TestUser_" + Date.now();
  let memberToken = null;
  let memberId = null;
  let targetEventId = null;

  async function assertStatus(name, req, expectedStatuses) {
    try {
      const res = await req();
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch(e) {}
      
      if (!expectedStatuses.includes(res.status)) {
        console.error(`❌ [FAILED] ${name} (Expected ${expectedStatuses.join('|')}, got ${res.status}): ${text}`);
        failed++;
        return { status: res.status, data, error: true };
      } else {
        console.log(`✅ [PASSED] ${name}`);
        passed++;
        return { status: res.status, data, error: false };
      }
    } catch (err) {
      console.error(`❌ [FAILED] ${name} - Exception: ${err.message}`);
      failed++;
      return { error: true };
    }
  }

  // 1. Group info
  await assertStatus("GET /groups/:groupId", 
    () => fetch(`${BASE_URL}/groups/${GROUP_ID}`), [200]);

  // 2. Events list
  const eventsRes = await assertStatus("GET /events/by-group/:groupId", 
    () => fetch(`${BASE_URL}/events/by-group/${GROUP_ID}`), [200, 403]);
  
  if (eventsRes.status === 200 && eventsRes.data.length > 0) {
    targetEventId = eventsRes.data[0].id;
  }

  // 3. Login / Register
  const loginRes = await assertStatus("POST /login-or-register (Create)", 
    () => fetch(`${BASE_URL}/groups/${GROUP_ID}/login-or-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testUserName, createIfNotFound: true, password: "pw" })
    }), [200, 201]);

  if (!loginRes.error) {
    memberToken = loginRes.data.token;
    memberId = loginRes.data.memberId;
  }

  // 4. Group Password Verify
  await assertStatus("POST /groups/:groupId/verify-password", 
    () => fetch(`${BASE_URL}/groups/${GROUP_ID}/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: "wrong_password" })
    }), [401]); // 失敗するのが正解

  // 5. Member Details
  if (memberId) {
    await assertStatus("GET /members/:memberId", 
      () => fetch(`${BASE_URL}/members/${memberId}?groupId=${GROUP_ID}`), [200]);
  }

  // 6. Join Event (if targetEventId exists)
  if (targetEventId && memberId) {
    await assertStatus("POST /events/:eventId/join (No token)", 
      () => fetch(`${BASE_URL}/events/${targetEventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: testUserName, memberId })
      }), [200, 400, 401, 403]); // 様々なステータスを許容（イベントの状態による）
      
    // 7. Verify Password and Join
    await assertStatus("POST /events/:eventId/verify-password", 
      () => fetch(`${BASE_URL}/events/${targetEventId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, password: "pw" })
      }), [200, 403, 409]); // 参加済みか満員で409等

    // 8. Delete Participant
    if (memberToken) {
      await assertStatus("DELETE /events/:eventId/participants", 
        () => fetch(`${BASE_URL}/events/${targetEventId}/participants`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleteToken: memberToken })
        }), [200, 404, 403]); // 404は見つからない（未参加など）
    }
  }

  console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
}

runFullTests();
