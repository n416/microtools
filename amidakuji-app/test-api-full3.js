const fetch = require('node-fetch');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:8787/api';
const SESSION_SECRET = 'eofeofj:ovjmna:opgjaogjapgojam\\ojfda/efj:aopfj';

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runFullTests() {
  console.log("=== API Complete Integration Tests ===");
  let passed = 0;
  let failed = 0;
  
  const testAdminId = "admin_" + Date.now();
  const testGroupId = "test-group-" + Date.now();
  let testEventId = null;
  let testMemberId = null;
  let testMemberToken = null;
  let copiedEventId = null;

  const adminToken = createToken({ targetUserId: testAdminId, name: 'Admin Test', email: 'test@example.com' }, SESSION_SECRET);
  const sessionCookie = `session=${adminToken}`;

  async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = options.headers || {};
    headers['Cookie'] = sessionCookie;
    
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    
    options.headers = headers;
    const res = await fetch(url, options);
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch(e) {}
    
    return { status: res.status, data, text };
  }

  async function assertStatus(name, reqPromise, expectedStatuses) {
    try {
      const res = await reqPromise;
      if (!expectedStatuses.includes(res.status)) {
        console.error(`❌ [FAILED] ${name} (Expected ${expectedStatuses.join('|')}, got ${res.status}): ${res.text}`);
        failed++;
        return { error: true, ...res };
      } else {
        console.log(`✅ [PASSED] ${name}`);
        passed++;
        return { error: false, ...res };
      }
    } catch (err) {
      console.error(`❌ [FAILED] ${name} - Exception: ${err.message}`);
      failed++;
      return { error: true };
    }
  }

  const createGroupRes = await assertStatus("POST /groups (Create Group)",
    request('/groups', { method: 'POST', body: { groupName: 'Test Group' } }),
    [201]
  );
  let createdGroupId = null;
  if (!createGroupRes.error) {
    createdGroupId = createGroupRes.data.id;
  }

  if (createdGroupId) {
    await assertStatus("PUT /groups/:groupId/settings",
      request(`/groups/${createdGroupId}/settings`, { method: 'PUT', body: { description: 'Updated' } }),
      [200]
    );

    const createEventRes = await assertStatus("POST /events (Create Event)",
      request('/events', { 
        method: 'POST', 
        body: { 
          groupId: createdGroupId, 
          eventName: "Test Event", 
          prizes: [{name: "A", type: "miss"}, {name: "B", type: "miss"}]
        } 
      }),
      [201]
    );
    if (!createEventRes.error) {
      testEventId = createEventRes.data.id;
    }

    const pLoginRes = await assertStatus("POST /groups/:groupId/login-or-register",
      request(`/groups/${createdGroupId}/login-or-register`, { method: 'POST', body: { name: 'Part1', createIfNotFound: true } }),
      [200, 201]
    );
    if (!pLoginRes.error) {
      testMemberId = pLoginRes.data.memberId;
      testMemberToken = pLoginRes.data.token;
    }

    if (testEventId && testMemberId) {
      await assertStatus("POST /events/:eventId/join",
        request(`/events/${testEventId}/join`, { method: 'POST', body: { name: 'Part1', memberId: testMemberId } }),
        [200, 409] 
      );

      await assertStatus("DELETE /events/:eventId/participants",
        request(`/events/${testEventId}/participants`, { method: 'DELETE', body: { deleteToken: testMemberToken } }),
        [200]
      );

      await assertStatus("POST /events/:eventId/join (Re-Join)",
        request(`/events/${testEventId}/join`, { method: 'POST', body: { name: 'Part1', memberId: testMemberId } }),
        [200, 409] 
      );

      await assertStatus("POST /events/:eventId/start",
        request(`/events/${testEventId}/start`, { method: 'POST' }),
        [200]
      );

      const copyRes = await assertStatus("POST /events/:eventId/copy",
        request(`/events/${testEventId}/copy`, { method: 'POST' }),
        [201]
      );
      if (!copyRes.error) copiedEventId = copyRes.data.id;

      await assertStatus("DELETE /events/:eventId",
        request(`/events/${testEventId}`, { method: 'DELETE' }),
        [200]
      );
      if (copiedEventId) {
        await assertStatus("DELETE /events/:eventId (Copied)",
          request(`/events/${copiedEventId}`, { method: 'DELETE' }),
          [200]
        );
      }
    }

    await assertStatus("DELETE /groups/:groupId",
      request(`/groups/${createdGroupId}`, { method: 'DELETE' }),
      [200]
    );
  }

  console.log(`\n=== Final Results: ${passed} Passed, ${failed} Failed ===`);
}

runFullTests();
