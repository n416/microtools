// js/api.js
import * as state from './state.js'; // stateをインポート

async function request(endpoint, method = 'GET', body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, options);
  const contentType = res.headers.get('content-type');

  if (!res.ok) {
    if (contentType && contentType.includes('application/json')) {
      const errData = await res.json();
      throw errData;
    }
    throw new Error(`Server error: ${res.status} ${res.statusText}`);
  }

  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return;
}

export const checkGoogleAuthState = () => request('/api/user/me');
export const updateLastGroup = (groupId) => request('/api/user/me/last-group', 'POST', {groupId});
export const deleteUserAccount = () => request('/api/user/me', 'DELETE');
export const getGroups = () => request('/api/groups');
export const getGroup = (groupId) => request(`/api/groups/${groupId}`);
export const getGroupByCustomUrl = (customUrl) => request(`/api/groups/url/${customUrl}`);
export const createGroup = (groupName) => request('/api/groups', 'POST', {groupName, participants: []});
export const deleteGroup = (groupId) => request(`/api/groups/${groupId}`, 'DELETE');
export const updateGroupSettings = (groupId, settings) => request(`/api/groups/${groupId}/settings`, 'PUT', settings);
export const verifyGroupPassword = (groupId, password) => request(`/api/groups/${groupId}/verify-password`, 'POST', {password});
export const deleteGroupPassword = (groupId) => request(`/api/groups/${groupId}/password`, 'DELETE');
export const getEventsForGroup = (groupId) => request(`/api/groups/${groupId}/events`);
export const getEventsByCustomUrl = (customUrl) => request(`/api/groups/url/${customUrl}/events`);
export const loginOrRegisterToGroup = (groupId, name) => request(`/api/groups/${groupId}/login-or-register`, 'POST', {name});
export const loginMemberToGroup = (groupId, memberId, password) => request(`/api/groups/${groupId}/login`, 'POST', {memberId, password});
export const getPublicEventsForGroup = (groupId) => request(`/api/events/by-group/${groupId}`);
export const getEvent = (id) => request(`/api/events/${id}`);
export const createEvent = (eventData) => request('/api/events', 'POST', eventData);
export const updateEvent = (id, eventData) => request(`/api/events/${id}`, 'PUT', eventData);
export const copyEvent = (eventId) => request(`/api/events/${eventId}/copy`, 'POST');
export const deleteEvent = (eventId) => request(`/api/events/${eventId}`, 'DELETE');
export const startEvent = (eventId) => request(`/api/events/${eventId}/start`, 'POST');
export const generateEventPrizeUploadUrl = (eventId, fileType, fileHash) => request(`/api/events/${eventId}/generate-upload-url`, 'POST', {fileType, fileHash});
export const addDoodle = (eventId, memberId, doodle) => request(`/api/events/${eventId}/doodle`, 'POST', { memberId, doodle }, { 'x-auth-token': state.currentParticipantToken });
// ▼▼▼ ここから修正 ▼▼▼
export const deleteDoodle = (eventId, memberId) => request(`/api/events/${eventId}/doodle`, 'DELETE', { memberId }, { 'x-auth-token': state.currentParticipantToken });
// ▲▲▲ ここまで修正 ▲▲▲

export const getPublicEventData = (eventId) => {
  const headers = {};
  if (state.currentParticipantId && state.currentParticipantToken) {
    headers['x-member-id'] = state.currentParticipantId;
    headers['x-auth-token'] = state.currentParticipantToken;
  }
  return request(`/api/events/${eventId}/public`, 'GET', null, headers);
};

export const getPublicShareData = (eventId, participantName) => request(`/api/share/${eventId}/${encodeURIComponent(participantName)}`);
export const joinEvent = (eventId, name, memberId) => request(`/api/events/${eventId}/join`, 'POST', {name, memberId});
export const joinSlot = (eventId, memberId, token, slot) => request(`/api/events/${eventId}/join-slot`, 'POST', {memberId, slot}, {'x-auth-token': token});
export const verifyPasswordAndJoin = (eventId, memberId, password, slot) => request(`/api/events/${eventId}/verify-password`, 'POST', {memberId, password, slot});
export const deleteParticipant = (eventId, token) => request(`/api/events/${eventId}/participants`, 'DELETE', {deleteToken: token});
export const getMemberSuggestions = (groupId, q) => request(`/api/groups/${groupId}/member-suggestions?q=${encodeURIComponent(q)}`);
export const getMemberDetails = (groupId, memberId) => request(`/api/members/${memberId}?groupId=${groupId}`);
export const deleteMemberAccount = (groupId, memberId, token) => request(`/api/members/${memberId}`, 'DELETE', {groupId}, {'x-auth-token': token});
export const requestPasswordDeletion = (memberId, groupId) => request(`/api/members/${memberId}/request-password-deletion`, 'POST', {groupId});
export const generateUploadUrl = (memberId, fileType, groupId, token) => request(`/api/members/${memberId}/generate-upload-url`, 'POST', {fileType, groupId}, {'x-auth-token': token});
export const updateProfile = (memberId, profileData, groupId, token) => request(`/api/members/${memberId}/profile`, 'PUT', {...profileData, groupId}, {'x-auth-token': token});
export const setPassword = (memberId, password, groupId, token) => request(`/api/members/${memberId}/set-password`, 'POST', {password, groupId}, {'x-auth-token': token});
export const getPrizeMasters = (groupId) => request(`/api/groups/${groupId}/prize-masters`);
export const generatePrizeMasterUploadUrl = (groupId, fileType) => request(`/api/groups/${groupId}/prize-masters/generate-upload-url`, 'POST', {fileType});
export const addPrizeMaster = (groupId, name, imageUrl) => request(`/api/groups/${groupId}/prize-masters`, 'POST', {name, imageUrl});
export const deletePrizeMaster = (masterId, groupId) => request(`/api/prize-masters/${masterId}`, 'DELETE', {groupId});
export const requestAdminAccess = () => request('/api/admin/request', 'POST');
export const getAdminRequests = () => request('/api/admin/requests');
export const approveAdminRequest = (requestId) => request('/api/admin/approve', 'POST', {requestId});
export const getSystemAdmins = (lastVisible = null, searchEmail = '') => {
  let endpoint = '/api/admin/system-admins';
  const params = new URLSearchParams();
  if (lastVisible) params.append('lastVisible', lastVisible);
  if (searchEmail) params.append('searchEmail', searchEmail);
  if (params.toString()) endpoint += `?${params.toString()}`;
  return request(endpoint);
};

export const getGroupAdmins = (lastVisible = null, searchEmail = '') => {
  let endpoint = '/api/admin/group-admins';
  const params = new URLSearchParams();
  if (lastVisible) params.append('lastVisible', lastVisible);
  if (searchEmail) params.append('searchEmail', searchEmail);
  if (params.toString()) endpoint += `?${params.toString()}`;
  return request(endpoint);
};
export const demoteAdmin = (userId) => request('/api/admin/demote', 'POST', {userId});
export const impersonateUser = (targetUserId) => request('/api/admin/impersonate', 'POST', {targetUserId});
export const stopImpersonating = () => request('/api/admin/stop-impersonating', 'POST');
export const getPasswordRequests = (groupId) => request(`/api/admin/groups/${groupId}/password-requests`);
export const approvePasswordReset = (memberId, groupId, requestId) => request(`/api/admin/members/${memberId}/delete-password`, 'POST', {groupId, requestId});
export const logout = () => request('/auth/logout', 'GET');
export const clearGroupVerification = () => request('/auth/clear-group-verification', 'POST');

// --- ▼▼▼ ここから新規追加 ▼▼▼ ---
// Member Management
export const getMembers = (groupId) => request(`/api/groups/${groupId}/members`);
export const addMember = (groupId, name) => request(`/api/groups/${groupId}/members`, 'POST', {name});
export const updateMember = (groupId, memberId, data) => request(`/api/groups/${groupId}/members/${memberId}`, 'PUT', data);
export const deleteMember = (groupId, memberId) => request(`/api/groups/${groupId}/members/${memberId}`, 'DELETE');
export const regenerateLines = (eventId) => request(`/api/events/${eventId}/regenerate-lines`, 'POST');
export const shufflePrizes = (eventId, shuffledPrizes) => request(`/api/events/${eventId}/shuffle-prizes`, 'POST', {shuffledPrizes});
export const acknowledgeResult = (eventId, memberId, token) => request(`/api/events/${eventId}/acknowledge-result`, 'POST', {memberId}, {'x-auth-token': token});

// Bulk Member Registration
export const analyzeBulkMembers = (groupId, namesText) => request(`/api/groups/${groupId}/members/analyze-bulk`, 'POST', {namesText});
export const finalizeBulkMembers = (groupId, resolutions) => request(`/api/groups/${groupId}/members/finalize-bulk`, 'POST', {resolutions});

export const updateMemberStatus = (groupId, memberId, isActive) => request(`/api/groups/${groupId}/members/${memberId}/status`, 'PUT', {isActive});

export const getUnjoinedMembers = (groupId, eventId) => request(`/api/groups/${groupId}/unjoined-members?eventId=${eventId}`);
export const fillSlots = (eventId, assignments) => request(`/api/events/${eventId}/fill-slots`, 'POST', {assignments});