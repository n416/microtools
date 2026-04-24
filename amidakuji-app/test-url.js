const fs = require('fs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

async function run() {
  const SESSION_SECRET = 'eofeofj:ovjmna:opgjaogjapgojam\\ojfda/efj:aopfj';
  const testAdminId = 'test_admin_123';
  const token = jwt.sign({ targetUserId: testAdminId, name: 'Admin Test', email: 'test@example.com' }, SESSION_SECRET);

  // 1. グループ作成
  const createRes = await fetch('http://127.0.0.1:8787/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session=' + token },
    body: JSON.stringify({ groupName: 'Test Group' })
  });
  const group = await createRes.json();
  const groupId = group.id;

  // 2. generate-upload-url 呼び出し
  const res = await fetch(`http://127.0.0.1:8787/api/groups/${groupId}/prize-masters/generate-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session=' + token },
    body: JSON.stringify({ fileType: 'image/png', fileHash: 'testhash123' })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
run();
