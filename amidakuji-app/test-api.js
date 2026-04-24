const BASE_URL = 'http://localhost:8787/api';
const GROUP_ID = '8dd71aa5-48a8-44a8-b2e9-b273be1f3dcc';

async function runTests() {
  console.log("=== API Integration Tests ===");
  try {
    // 1. グループ情報の取得
    console.log(`\n[1] GET /groups/${GROUP_ID}`);
    let res = await fetch(`${BASE_URL}/groups/${GROUP_ID}`);
    let data = await res.json();
    console.log("Status:", res.status);
    if (res.status !== 200) throw new Error(JSON.stringify(data));
    console.log("Success: Group name =", data.name);

    // 2. イベント一覧の取得
    console.log(`\n[2] GET /events/by-group/${GROUP_ID}`);
    res = await fetch(`${BASE_URL}/events/by-group/${GROUP_ID}`);
    data = await res.json();
    console.log("Status:", res.status);
    if (res.status !== 200 && res.status !== 403) throw new Error(JSON.stringify(data));
    console.log("Success: Events response =", data.error ? data.error : data.length + " events");

    // 3. ログイン (合言葉なし)
    const testUserName = "テスト太郎_" + Date.now();
    console.log(`\n[3] POST /groups/${GROUP_ID}/login-or-register (名前のみ、新規作成)`);
    res = await fetch(`${BASE_URL}/groups/${GROUP_ID}/login-or-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testUserName, createIfNotFound: true, password: "testpassword" })
    });
    data = await res.json();
    console.log("Status:", res.status);
    if (res.status !== 200 && res.status !== 201) throw new Error(JSON.stringify(data));
    console.log("Success: Logged in or Registered, token =", data.token);

    // 4. 同じユーザーで再度ログイン (合言葉なし -> エラーになるべき)
    console.log(`\n[4] POST /groups/${GROUP_ID}/login-or-register (同名で再ログイン・パスワードなし)`);
    res = await fetch(`${BASE_URL}/groups/${GROUP_ID}/login-or-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testUserName })
    });
    data = await res.json();
    console.log("Status:", res.status);
    if (res.status !== 401) throw new Error("Expected 401, but got " + res.status + " " + JSON.stringify(data));
    console.log("Success: Expected error returned =", data.error, "requiresPassword:", data.requiresPassword);

    // 5. 同じユーザーでパスワードありでログイン
    console.log(`\n[5] POST /groups/${GROUP_ID}/login-or-register (同名で再ログイン・パスワードあり)`);
    res = await fetch(`${BASE_URL}/groups/${GROUP_ID}/login-or-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testUserName, password: "testpassword" })
    });
    data = await res.json();
    console.log("Status:", res.status);
    if (res.status !== 200) throw new Error(JSON.stringify(data));
    console.log("Success: Logged in successfully");

    console.log("\n✅ All tests passed successfully.");
  } catch (err) {
    console.error("\n❌ Test Failed:", err.message);
  }
}

runTests();
