const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:8787/api';

async function runFullTests() {
  console.log("=== API Complete Integration Tests ===");
  let passed = 0;
  let failed = 0;
  
  const testAdminId = "admin_" + Date.now();
  let sessionCookie = "";
  let testGroupId = null;
  let testEventId = null;
  let testMemberId = null;
  let testMemberToken = null;
  let copiedEventId = null;

  async function request(path, options = {}) {
    const url = path.startsWith("/auth") ? `http://localhost:8787${path}` : `${BASE_URL}${path}`;
    const headers = options.headers || {};
    if (sessionCookie) headers['Cookie'] = sessionCookie;
    
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    
    options.headers = headers;
    const res = await fetch(url, options);
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch(e) {}
    
    // session Cookieの保孁E    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
    
    return { status: res.status, data, text };
  }

  async function assertStatus(name, reqPromise, expectedStatuses) {
    try {
      const res = await reqPromise;
      if (!expectedStatuses.includes(res.status)) {
        console.error(`❁E[FAILED] ${name} (Expected ${expectedStatuses.join('|')}, got ${res.status}): ${res.text}`);
        failed++;
        return { error: true, ...res };
      } else {
        console.log(`✁E[PASSED] ${name}`);
        passed++;
        return { error: false, ...res };
      }
    } catch (err) {
      console.error(`❁E[FAILED] ${name} - Exception: ${err.message}`);
      failed++;
      return { error: true };
    }
  }

  // 1. Admin Login
  const loginRes = await assertStatus("POST /auth/test-login", 
    request('/auth/test-login', { method: 'POST', body: { targetUserId: testAdminId, name: 'Admin', email: 'test@example.com' } }),
    [200]
  );

  // 2. Create Group
  const createGroupRes = await assertStatus("POST /groups (Create Group)",
    request('/groups', { method: 'POST', body: { groupName: 'Test Group' } }),
    [201]
  );
  if (!createGroupRes.error) {
    testGroupId = createGroupRes.data.id;
  }

  if (testGroupId) {
    // 3. Update Group Settings
    await assertStatus("PUT /groups/:groupId/settings",
      request(`/groups/${testGroupId}/settings`, { method: 'PUT', body: { description: 'Updated' } }),
      [200]
    );

    // 4. Create Event
    const createEventRes = await assertStatus("POST /events (Create Event)",
      request('/events', { method: 'POST', body: { groupId: testGroupId, title: 'Test Event', type: 'standard', items: [], participants: [{name: null, iconUrl: null}], customItemNames: [] } }),
      [201]
    );
    if (!createEventRes.error) {
      testEventId = createEventRes.data.id;
    }

    // 5. Participant Login/Register (to get memberId and token)
    const pLoginRes = await assertStatus("POST /groups/:groupId/login-or-register",
      request(`/groups/${testGroupId}/login-or-register`, { method: 'POST', body: { name: 'Part1', createIfNotFound: true } }),
      [200, 201]
    );
    if (!pLoginRes.error) {
      testMemberId = pLoginRes.data.memberId;
      testMemberToken = pLoginRes.data.token;
    }

    if (testEventId && testMemberId) {
      // 6. Join Event
      await assertStatus("POST /events/:eventId/join",
        request(`/events/${testEventId}/join`, { method: 'POST', body: { name: 'Part1', memberId: testMemberId } }),
        [200, 409] // OK or Already joined
      );

      // 7. Start Event
      await assertStatus("POST /events/:eventId/start",
        request(`/events/${testEventId}/start`, { method: 'POST' }),
        [200]
      );

      // 8. Delete Participant
      await assertStatus("DELETE /events/:eventId/participants",
        request(`/events/${testEventId}/participants`, { method: 'DELETE', body: { deleteToken: testMemberToken } }),
        [200, 403, 400] // Since it's started, it might fail or succeed depending on logic
      );

      // 9. Copy Event
      const copyRes = await assertStatus("POST /events/:eventId/copy",
        request(`/events/${testEventId}/copy`, { method: 'POST' }),
        [201]
      );
      if (!copyRes.error) copiedEventId = copyRes.data.id;

      // 10. Delete Event
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

    // 11. Delete Group
    await assertStatus("DELETE /groups/:groupId",
      request(`/groups/${testGroupId}`, { method: 'DELETE' }),
      [200]
    );
  }

  console.log(`\n=== Final Results: ${passed} Passed, ${failed} Failed ===`);
}

runFullTests();
