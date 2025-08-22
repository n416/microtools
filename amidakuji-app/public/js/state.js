// js/state.js

export let allUserGroups = [];
export let prizes = [];
export let currentLotteryData = null;
export let currentUser = null;
export let currentGroupId = null;
export let currentEventId = null;
export let selectedSlot = null;
export let groupParticipants = [];
export let currentParticipantToken = null;
export let currentParticipantId = null;
export let currentParticipantName = null;
export let debounceTimer;
export let lastFailedAction = null;
export let revealedPrizes = [];

export function setAllUserGroups(groups) {
  allUserGroups = groups;
}
export function setPrizes(newPrizes) {
  prizes = newPrizes;
}
export function setCurrentLotteryData(data) {
  currentLotteryData = data;
}
export function setCurrentUser(user) {
  currentUser = user;
}
export function setCurrentGroupId(id) {
  currentGroupId = id;
}
export function setCurrentEventId(id) {
  currentEventId = id;
}
export function setSelectedSlot(slot) {
  selectedSlot = slot;
}
export function setGroupParticipants(participants) {
  groupParticipants = participants;
}
export function setDebounceTimer(timer) {
  debounceTimer = timer;
}

export function setLastFailedAction(action) {
  lastFailedAction = action;
}
export function setRevealedPrizes(prizes) {
  revealedPrizes = prizes;
}

export function loadParticipantState() {
  if (!currentGroupId) return;
  currentParticipantToken = localStorage.getItem(`token-group-${currentGroupId}`);
  currentParticipantId = localStorage.getItem(`memberId-group-${currentGroupId}`);
  currentParticipantName = localStorage.getItem(`memberName-group-${currentGroupId}`);
}

export function saveParticipantState(token, memberId, name) {
  if (!currentGroupId) return;
  localStorage.setItem(`token-group-${currentGroupId}`, token);
  localStorage.setItem(`memberId-group-${currentGroupId}`, memberId);
  localStorage.setItem(`memberName-group-${currentGroupId}`, name);
  loadParticipantState();
}

export function clearParticipantState() {
  if (!currentGroupId) return;
  localStorage.removeItem(`token-group-${currentGroupId}`);
  localStorage.removeItem(`memberId-group-${currentGroupId}`);
  localStorage.removeItem(`memberName-group-${currentGroupId}`);
  currentParticipantToken = null;
  currentParticipantId = null;
  currentParticipantName = null;
}
