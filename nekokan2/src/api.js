const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787/api';

export const createRoom = async (stateJson, password = '') => {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state_json: stateJson, password }),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
};

export const fetchRoomState = async (roomId, password = '') => {
  const headers = {};
  if (password) headers['X-Room-Password'] = password;

  const res = await fetch(`${API_BASE}/rooms/${roomId}`, { headers });
  if (res.status === 401) {
    throw new Error('Unauthorized'); // Password required or incorrect
  }
  if (!res.ok) throw new Error('Failed to fetch room state');
  return res.json();
};

export const updateRoomState = async (roomId, stateJson, password = '') => {
  const headers = { 'Content-Type': 'application/json' };
  if (password) headers['X-Room-Password'] = password;

  const res = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ state_json: stateJson }),
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to update room state');
  return res.json();
};

export const changeRoomPassword = async (roomId, ownerToken, newPassword) => {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/password`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'X-Owner-Token': ownerToken
    },
    body: JSON.stringify({
      new_password: newPassword,
    }),
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to change password');
  return res.json();
};
