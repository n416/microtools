// js/main.js
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import { handleRouting } from './router.js';
import { startAnimation, stopAnimation, prepareStepAnimation, resetAnimation, stepAnimation } from './animation.js';

const { elements } = ui;

// --- アプリケーションの初期化 ---
async function initializeApp() {
    setupEventListeners();

    const initialData = {
        group: typeof initialGroupData !== 'undefined' ? initialGroupData : null,
        event: typeof initialEventData !== 'undefined' ? initialEventData : null,
    };

    await handleRouting(initialData);

    if (state.currentUser && !window.location.pathname.startsWith('/g/') && !window.location.pathname.startsWith('/share/')) {
        if(state.currentUser.role === 'system_admin' && !state.currentUser.isImpersonating && window.location.pathname.endsWith('/admin')) {
            await loadAdminDashboard();
        } else {
            await loadUserGroupsAndRedirect(state.currentUser.lastUsedGroupId);
        }
    }
}

// --- データ読み込み & 表示 ---
async function loadUserGroupsAndRedirect(lastUsedGroupId) {
    try {
        const groups = await api.getGroups();
        state.setAllUserGroups(groups);
        ui.renderGroupList(groups, {}); // renderGroupListのハンドラはイベント委譲で対応するため空でOK

        if (groups.length > 0) {
            let targetGroup = groups.find(g => g.id === lastUsedGroupId) || groups[0];
            await showDashboardForGroup(targetGroup.id, targetGroup.name);
        } else {
            ui.showView('groupDashboard');
        }
        ui.updateGroupSwitcher();
    } catch (error) {
        console.error(error);
        ui.showView('groupDashboard');
    }
}

async function loadAdminDashboard() {
    try {
        const [requests, groupAdmins, systemAdmins] = await Promise.all([
            api.getAdminRequests(),
            api.getGroupAdmins(),
            api.getSystemAdmins()
        ]);
        ui.renderAdminLists(requests, groupAdmins, systemAdmins, {
            onApprove: handleApproveAdmin,
            onImpersonate: handleImpersonate,
            onDemote: handleDemoteAdmin
        });
    } catch (error) {
        console.error("管理ダッシュボードの読み込みに失敗:", error);
    }
}

async function loadEventsForGroup(groupId) {
    try {
        const events = await api.getEventsForGroup(groupId);
        ui.renderEventList(events, {
            onEdit: (eventId) => loadEventForEditing(eventId, 'eventEditView'),
            onStart: (eventId) => loadEventForEditing(eventId, 'broadcastView'),
            onCopy: handleCopyEvent
        });
    } catch (error) {
        console.error(`イベント一覧の読み込み失敗 (Group ID: ${groupId}):`, error);
        if(elements.eventList) elements.eventList.innerHTML = `<li class="error-message">${error.error || error.message}</li>`;
    }
}

async function showDashboardForGroup(groupId, groupName) {
    state.setCurrentGroupId(groupId);
    ui.showView('dashboardView');
    if (elements.eventGroupName) elements.eventGroupName.textContent = `グループ: ${groupName}`;
    await loadEventsForGroup(groupId);
}

async function loadEventForEditing(eventId, viewToShow = 'eventEditView') {
    if (!eventId) return;
    try {
        const data = await api.getEvent(eventId);
        state.setCurrentLotteryData(data);
        state.setCurrentEventId(eventId);
        state.setCurrentGroupId(data.groupId);

        ui.showView(viewToShow);

        const parentGroup = state.allUserGroups.find(g => g.id === data.groupId);
        const url = (parentGroup && parentGroup.customUrl)
            ? `${window.location.origin}/g/${parentGroup.customUrl}/${eventId}`
            : `/events/${eventId}`;

        if (elements.currentEventUrl) {
            elements.currentEventUrl.textContent = url;
            elements.currentEventUrl.href = url;
        }
        if (elements.eventIdInput) elements.eventIdInput.value = eventId;

        if (viewToShow === 'eventEditView') {
            elements.eventNameInput.value = data.eventName || '';
            state.setPrizes(data.prizes || []);
            elements.participantCountInput.value = data.participantCount;
            elements.displayModeSelect.value = data.displayMode;
            elements.createEventButton.textContent = 'この内容でイベントを保存';
            ui.renderPrizeList();
        } else if (viewToShow === 'broadcastView') {
            if (data.status === 'pending') {
                if (elements.adminControls) elements.adminControls.style.display = 'block';
                if (elements.startEventButton) elements.startEventButton.style.display = 'inline-block';
                if (elements.broadcastControls) elements.broadcastControls.style.display = 'none';
                if (elements.adminCanvas) elements.adminCanvas.style.display = 'none';
            } else if (data.status === 'started') {
                if (elements.adminControls) elements.adminControls.style.display = 'none';
                if (elements.broadcastControls) elements.broadcastControls.style.display = 'flex';
                if (elements.adminCanvas) elements.adminCanvas.style.display = 'block';

                const allParticipants = data.participants.filter(p => p.name);
                if(elements.highlightUserSelect) {
                    elements.highlightUserSelect.innerHTML = allParticipants.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
                }

                const ctx = elements.adminCanvas.getContext('2d');
                await prepareStepAnimation(ctx);
            }
        }
    } catch (error) {
        alert(error.error || 'イベントの読み込みに失敗しました。');
    }
}

// --- イベントハンドラ ---

async function handleSaveSettings() {
    const groupId = elements.settingsGroupId.value;
    const settingsPayload = {
        groupName: elements.groupNameEditInput.value.trim(),
        customUrl: elements.customUrlInput.value.trim(),
        noIndex: elements.noIndexCheckbox.checked,
    };
    if (elements.groupPasswordInput.value) {
        settingsPayload.password = elements.groupPasswordInput.value;
    }

    elements.saveGroupSettingsButton.disabled = true;
    try {
        await api.updateGroupSettings(groupId, settingsPayload);
        await api.updateParticipants(groupId, { participants: state.groupParticipants });
        alert('設定を保存しました。');
        ui.closeSettingsModal();
        await loadUserGroupsAndRedirect(state.currentGroupId);
    } catch (error) {
        alert(error.error || '設定の保存に失敗しました。');
    } finally {
        elements.saveGroupSettingsButton.disabled = false;
    }
}


async function handleLoginOrRegister(name, memberId = null) {
    if (!name) return;
    try {
        const result = await api.joinEvent(state.currentEventId, name, memberId);
        state.saveParticipantState(result.token, result.memberId, result.name);
        await handleRouting({ group: null, event: null });
    } catch (error) {
        if (error.requiresPassword) {
            const password = prompt(`「${error.name}」さんの合言葉を入力してください:`);
            if (password) {
                await verifyAndLogin(error.memberId, password);
            } else {
                const forgot = confirm('合言葉を忘れましたか？管理者にリセットを依頼します。');
                if (forgot) {
                    await api.requestPasswordDeletion(error.memberId, state.currentGroupId);
                    alert('管理者に合言葉の削除を依頼しました。');
                }
            }
        } else {
            alert(error.error);
        }
    }
}

async function verifyAndLogin(memberId, password, slot = null) {
    try {
        const result = await api.verifyPasswordAndJoin(state.currentEventId, memberId, password, slot);
        state.saveParticipantState(result.token, result.memberId, result.name);
        if (slot !== null) {
            ui.showWaitingView();
        } else {
            await handleRouting({ group: null, event: null });
        }
    } catch (error) {
        alert(error.error);
    }
}

async function handleCopyEvent(eventId) {
    if (!confirm('このイベントをコピーしますか？')) return;
    try {
        await api.copyEvent(eventId);
        alert('イベントをコピーしました。');
        await loadEventsForGroup(state.currentGroupId);
    } catch (error) {
        alert(`エラー: ${error.error}`);
    }
}

async function handleApproveAdmin(requestId) {
    if (!confirm('このユーザーの管理者権限を承認しますか？')) return;
    try {
        await api.approveAdminRequest(requestId);
        alert('申請を承認しました。');
        await loadAdminDashboard();
    } catch (error) {
        alert(error.error);
    }
}

async function handleImpersonate(userId) {
    if (!confirm('このユーザーとしてログインしますか？')) return;
    try {
        await api.impersonateUser(userId);
        alert('成り代わりました。ページをリロードします。');
        window.location.href = '/';
    } catch(error) {
        alert(error.error);
    }
}

async function handleDemoteAdmin(userId) {
    if (!confirm('本当にこのシステム管理者を通常ユーザーに戻しますか？')) return;
    try {
        await api.demoteAdmin(userId);
        alert('ユーザーを降格させました。');
        await loadAdminDashboard();
    } catch(error) {
        alert(error.error);
    }
}

function handleShareResult() {
    if (!state.currentEventId || !state.currentParticipantName) return;
    const shareUrl = `${window.location.origin}/share/${state.currentEventId}/${encodeURIComponent(state.currentParticipantName)}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        alert('クリップボードにシェア用URLをコピーしました！');
      })
      .catch((err) => {
        prompt('このURLをコピーしてシェアしてください:', shareUrl);
      });
}

function setupEventListeners() {
    if (elements.loginButton) elements.loginButton.addEventListener('click', () => { window.location.href = '/auth/google'; });
    if (elements.logoutButton) elements.logoutButton.addEventListener('click', () => {
        state.clearParticipantState();
        window.location.href = '/auth/logout';
    });
    if (elements.deleteAccountButton) elements.deleteAccountButton.addEventListener('click', async () => {
        if (!confirm('本当にアカウントを削除しますか？関連する全てのデータが完全に削除され、元に戻すことはできません。')) return;
        try {
            await api.deleteUserAccount();
            alert('アカウントを削除しました。');
            window.location.href = '/';
        } catch (error) {
            alert(error.error);
        }
    });
    if (elements.requestAdminButton) elements.requestAdminButton.addEventListener('click', async () => {
        if (!confirm('システム管理者権限を申請しますか？')) return;
        try {
            const result = await api.requestAdminAccess();
            alert(result.message);
            elements.requestAdminButton.textContent = '申請中';
            elements.requestAdminButton.disabled = true;
        } catch (error) {
            alert(`エラー: ${error.error}`);
        }
    });
    if (elements.stopImpersonatingButton) elements.stopImpersonatingButton.addEventListener('click', async () => {
        try {
            await api.stopImpersonating();
            alert('成り代わりを解除しました。ページをリロードします。');
            window.location.href = '/admin';
        } catch(error) {
            alert(error.error);
        }
    });
    if (elements.createGroupButton) elements.createGroupButton.addEventListener('click', async () => {
        const name = elements.groupNameInput.value.trim();
        if (!name) return alert('グループ名を入力してください。');
        try {
            await api.createGroup(name);
            elements.groupNameInput.value = '';
            await loadUserGroupsAndRedirect();
        } catch (error) {
            alert(error.error);
        }
    });

    if (elements.groupList) {
        elements.groupList.addEventListener('click', async (e) => {
            const groupItem = e.target.closest('.item-list-item');
            if (!groupItem) return;
            const { groupId, groupName } = groupItem.dataset;

            if (e.target.closest('button')) {
                state.setCurrentGroupId(groupId);
                const groupData = state.allUserGroups.find(g => g.id === groupId);
                if (groupData) {
                    groupData.hasPassword = !!groupData.password;
                    // ▼▼▼▼▼ ここが修正箇所です ▼▼▼▼▼
                    ui.openSettingsModal(groupData, {
                        onSave: handleSaveSettings,
                        onDeletePassword: async () => {
                            if (!confirm('本当にこのグループの合言葉を削除しますか？')) return;
                            try {
                                await api.deleteGroupPassword(groupId);
                                alert('合言葉を削除しました。');
                                if (elements.deletePasswordButton) {
                                    elements.deletePasswordButton.style.display = 'none';
                                }
                                // stateのデータも更新
                                const groupInState = state.allUserGroups.find(g => g.id === groupId);
                                if (groupInState) delete groupInState.password;
                            } catch (error) {
                                alert(error.error);
                            }
                        },
                         // ... その他のハンドラは既存のまま ...
                        onAddParticipant: () => {
                            const name = elements.addParticipantNameInput.value.trim();
                            if (!name) return;
                            const newParticipant = {
                                id: `temp_${Date.now()}`, name,
                                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
                            };
                            state.groupParticipants.push(newParticipant);
                            ui.renderParticipantManagementList({
                                onDeleteParticipant: (id) => {
                                    state.setGroupParticipants(state.groupParticipants.filter(p => p.id !== id));
                                    ui.renderParticipantManagementList(/** handlers */);
                                },
                                onChangeColor: (id, color) => {
                                    const p = state.groupParticipants.find(p => p.id === id);
                                    if(p) p.color = color;
                                }
                            });
                            elements.addParticipantNameInput.value = '';
                        },
                        onDeleteParticipant: (participantId) => {
                            state.setGroupParticipants(state.groupParticipants.filter(p => p.id !== participantId));
                            ui.renderParticipantManagementList(/** handlers */);
                        },
                        onChangeColor: (participantId, newColor) => {
                            const participant = state.groupParticipants.find(p => p.id === participantId);
                            if (participant) participant.color = newColor;
                        },
                        onAddMaster: async () => {
                            const name = elements.addMasterPrizeNameInput.value.trim();
                            const file = elements.addMasterPrizeImageInput.files[0];
                            if(!name || !file) return alert('賞品名と画像を選択してください');
                            try {
                                const { signedUrl, imageUrl } = await api.generatePrizeMasterUploadUrl(groupId, file.type);
                                await fetch(signedUrl, { method: 'PUT', headers: {'Content-Type': file.type}, body: file });
                                await api.addPrizeMaster(groupId, name, imageUrl);
                                alert('賞品マスターを追加しました。');
                                const masters = await api.getPrizeMasters(groupId);
                                ui.renderPrizeMasterList(masters, false);
                            } catch (error) {
                                alert(error.error);
                            }
                        },
                        onDeleteMaster: async (masterId) => {
                            if(!confirm('この賞品マスターを削除しますか？')) return;
                            try {
                                await api.deletePrizeMaster(masterId, groupId);
                                alert('削除しました');
                                const masters = await api.getPrizeMasters(groupId);
                                ui.renderPrizeMasterList(masters, false);
                            } catch (error) {
                                alert(error.error);
                            }
                        },
                        onApproveReset: async (memberId, groupId, requestId) => {
                            if(!confirm('このユーザーの合言葉を削除しますか？')) return;
                            try {
                                await api.approvePasswordReset(memberId, groupId, requestId);
                                alert('合言葉を削除しました。');
                                const requests = await api.getPasswordRequests(groupId);
                                ui.renderPasswordRequests(requests);
                            } catch (error) {
                                alert(error.error);
                            }
                        }
                    });
                     // ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲
                    await api.getPasswordRequests(groupId).then(ui.renderPasswordRequests);
                    await api.getPrizeMasters(groupId).then(masters => ui.renderPrizeMasterList(masters, false));
                }
            } else {
                await showDashboardForGroup(groupId, groupName);
                await api.updateLastGroup(groupId);
                ui.updateGroupSwitcher();
            }
        });
    }


    if (elements.eventList) {
        elements.eventList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            const item = e.target.closest('.item-list-item');
            if (!item) return;

            if (button) {
                const eventId = button.dataset.eventId;
                if (!eventId) return;
                e.stopPropagation();
                if (button.classList.contains('edit-event-btn')) {
                    loadEventForEditing(eventId, 'eventEditView');
                } else if (button.classList.contains('start-event-btn')) {
                    loadEventForEditing(eventId, 'broadcastView');
                } else if (button.classList.contains('copy-event-btn')) {
                    handleCopyEvent(eventId);
                }
            } else {
                const eventId = item.querySelector('.edit-event-btn')?.dataset.eventId;
                if (eventId) {
                    loadEventForEditing(eventId, 'eventEditView');
                }
            }
        });
    }

    if (elements.adminDashboard) {
        elements.adminDashboard.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.classList.contains('impersonate-btn')) {
                handleImpersonate(button.dataset.userId);
            } else if (button.classList.contains('approve-btn')) {
                handleApproveAdmin(button.dataset.requestId);
            } else if (button.classList.contains('demote-btn')) {
                handleDemoteAdmin(button.dataset.userId);
            }
        });
    }

    if (elements.currentGroupName) {
        elements.currentGroupName.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.groupDropdown.style.display = elements.groupDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    if (elements.switcherGroupList) {
        elements.switcherGroupList.addEventListener('click', async (e) => {
            if (e.target.tagName === 'BUTTON') {
                const { groupId, groupName } = e.target.dataset;
                await showDashboardForGroup(groupId, groupName);
                await api.updateLastGroup(groupId);
                ui.updateGroupSwitcher();
                elements.groupDropdown.style.display = 'none';
            }
        });
    }

    if (elements.switcherCreateGroup) {
        elements.switcherCreateGroup.addEventListener('click', () => {
            elements.groupDropdown.style.display = 'none';
            ui.showView('groupDashboard');
            if (elements.groupNameInput) {
                elements.groupNameInput.focus();
            }
        });
    }

    if (elements.goToGroupSettingsButton) {
        elements.goToGroupSettingsButton.addEventListener('click', async () => {
            if (state.currentGroupId) {
                const currentGroup = state.allUserGroups.find((g) => g.id === state.currentGroupId);
                if (currentGroup) {
                    currentGroup.hasPassword = !!currentGroup.password;
                    ui.openSettingsModal(currentGroup, {
                        onSave: handleSaveSettings,
                        onDeletePassword: async () => {
                            if (!confirm('本当にこのグループの合言葉を削除しますか？')) return;
                            try {
                                await api.deleteGroupPassword(state.currentGroupId);
                                alert('合言葉を削除しました。');
                                if (elements.deletePasswordButton) {
                                    elements.deletePasswordButton.style.display = 'none';
                                }
                                const groupInState = state.allUserGroups.find(g => g.id === state.currentGroupId);
                                if (groupInState) delete groupInState.password;
                            } catch (error) {
                                alert(error.error);
                            }
                        },
                    });
                    await api.getPasswordRequests(state.currentGroupId).then(ui.renderPasswordRequests);
                    await api.getPrizeMasters(state.currentGroupId).then(masters => ui.renderPrizeMasterList(masters, false));
                } else {
                    alert('グループ情報が見つかりませんでした。');
                }
            }
        });
    }

    if (elements.closeSettingsModalButton) elements.closeSettingsModalButton.addEventListener('click', ui.closeSettingsModal);
    if (elements.closePasswordSetModal) elements.closePasswordSetModal.addEventListener('click', () => { if(elements.passwordSetModal) elements.passwordSetModal.style.display = 'none' });
    if (elements.closeProfileModalButton) elements.closeProfileModalButton.addEventListener('click', ui.closeProfileEditModal);
    if (elements.closePrizeMasterSelectModal) elements.closePrizeMasterSelectModal.addEventListener('click', ui.closePrizeMasterSelectModal);
    if (elements.closeGroupPasswordModalButton) elements.closeGroupPasswordModalButton.addEventListener('click', ui.closeGroupPasswordModal);


    if(elements.verifyPasswordButton) elements.verifyPasswordButton.addEventListener('click', async () => {
        const groupId = elements.verificationTargetGroupId.value;
        const password = elements.groupPasswordVerifyInput.value;
        if (!password) return alert('合言葉を入力してください。');
        try {
            const result = await api.verifyGroupPassword(groupId, password);
            if (result.success) {
                alert('認証しました！');
                ui.closeGroupPasswordModal();
                if (state.lastFailedAction) {
                    await state.lastFailedAction();
                    state.setLastFailedAction(null);
                } else {
                    window.location.reload();
                }
            }
        } catch (error) {
            alert(`エラー: ${error.error}`);
        }
    });

    if(elements.customUrlInput) elements.customUrlInput.addEventListener('keyup', () => {
        if(elements.customUrlPreview) elements.customUrlPreview.textContent = elements.customUrlInput.value.trim();
    });

    if(elements.goToCreateEventViewButton) elements.goToCreateEventViewButton.addEventListener('click', () => {
        ui.resetEventCreationForm();
        ui.showView('eventEditView');
    });

    if (elements.backToGroupsButton) {
        elements.backToGroupsButton.addEventListener('click', async () => {
            const currentGroup = state.allUserGroups.find(g => g.id === state.currentGroupId);
            if (currentGroup) {
                await showDashboardForGroup(currentGroup.id, currentGroup.name);
            } else {
                ui.showView('groupDashboard'); // Fallback
            }
        });
    }

    if(elements.createEventButton) elements.createEventButton.addEventListener('click', async () => {
        const isUpdate = !!state.currentEventId;
        const participantCount = parseInt(elements.participantCountInput.value, 10);
        if (!participantCount || participantCount < 2) return alert('参加人数は2人以上で設定してください。');
        if (state.prizes.length !== participantCount) return alert('参加人数と景品の数は同じにしてください。');

        const eventData = {
            eventName: elements.eventNameInput.value.trim(),
            prizes: state.prizes,
            participantCount,
            displayMode: elements.displayModeSelect.value,
        };

        try {
            elements.createEventButton.disabled = true;
            elements.createEventButton.textContent = isUpdate ? '保存中...' : '作成中...';
            if (isUpdate) {
                await api.updateEvent(state.currentEventId, eventData);
                alert('イベントを更新しました！');
            } else {
                eventData.groupId = state.currentGroupId;
                await api.createEvent(eventData);
                alert(`イベントが作成されました！`);
            }
            const currentGroup = state.allUserGroups.find(g=>g.id === state.currentGroupId);
            await showDashboardForGroup(state.currentGroupId, currentGroup.name);
        } catch (error) {
            alert(error.error);
        } finally {
            elements.createEventButton.disabled = false;
        }
    });

    if(elements.loadButton) elements.loadButton.addEventListener('click', () => loadEventForEditing(elements.eventIdInput.value.trim()));
    if(elements.backToDashboardButton) elements.backToDashboardButton.addEventListener('click', async () => {
        const currentGroup = state.allUserGroups.find(g => g.id === state.currentGroupId);
        if(currentGroup) await showDashboardForGroup(currentGroup.id, currentGroup.name);
    });
    if(elements.startEventButton) elements.startEventButton.addEventListener('click', async () => {
        if (!confirm('イベントを開始しますか？\n開始後は新規参加ができなくなります。')) return;
        try {
            await api.startEvent(state.currentEventId);
            alert('イベントを開始しました！');
            await loadEventForEditing(state.currentEventId, 'broadcastView');
        } catch (error) {
            alert(`エラー: ${error.error}`);
        }
    });
    if(elements.animateAllButton) elements.animateAllButton.addEventListener('click', resetAnimation);
    if(elements.nextStepButton) elements.nextStepButton.addEventListener('click', stepAnimation);
    if(elements.highlightUserButton) elements.highlightUserButton.addEventListener('click', async () => {
        if (elements.highlightUserSelect.value) {
            const ctx = elements.adminCanvas.getContext('2d');
            await startAnimation(ctx, [elements.highlightUserSelect.value]);
        }
    });
    if(elements.nameInput) elements.nameInput.addEventListener('keyup', () => {
        clearTimeout(state.debounceTimer);
        const query = elements.nameInput.value.trim();
        if (query.length === 0) {
            if (elements.suggestionList) elements.suggestionList.innerHTML = '';
            return;
        }
        state.setDebounceTimer(setTimeout(async () => {
            try {
                const suggestions = await api.getMemberSuggestions(state.currentGroupId, query);
                ui.renderSuggestions(suggestions, async (name, memberId, hasPassword) => {
                    elements.nameInput.value = name;
                    elements.suggestionList.innerHTML = '';
                    if (hasPassword) {
                        const password = prompt(`「${name}」さんの合言葉を入力してください:`);
                        if (password) await verifyAndLogin(memberId, password);
                    } else {
                        await handleLoginOrRegister(name, memberId);
                    }
                });
            } catch (e) { console.error('Suggestion fetch failed', e); }
        }, 300));
    });
    if(elements.confirmNameButton) elements.confirmNameButton.addEventListener('click', () => handleLoginOrRegister(elements.nameInput.value.trim()));
    if(elements.goToAmidaButton) elements.goToAmidaButton.addEventListener('click', async () => {
        const eventData = await api.getPublicEventData(state.currentEventId);
        state.setCurrentLotteryData(eventData);
        if (eventData.status === 'started') {
            await handleRouting({ group: null, event: null });
        } else {
            const myParticipation = eventData.participants.find(p => p.memberId === state.currentParticipantId);
            if (myParticipation && myParticipation.name) {
                ui.showWaitingView();
            } else {
                ui.showJoinView(eventData);
            }
        }
    });
    if(elements.backToControlPanelButton) elements.backToControlPanelButton.addEventListener('click', async () => {
        const eventData = await api.getPublicEventData(state.currentEventId);
        ui.showControlPanelView(eventData);
    });
    if(elements.backToControlPanelFromResultButton) elements.backToControlPanelFromResultButton.addEventListener('click', async () => {
        const eventData = await api.getPublicEventData(state.currentEventId);
        ui.hideParticipantSubViews();
        ui.showControlPanelView(eventData);
    });
    if(elements.setPasswordButton) elements.setPasswordButton.addEventListener('click', () => {
        ui.openPasswordSetModal({
            onSave: async () => {
                const password = elements.newPasswordInput.value;
                try {
                    await api.setPassword(state.currentParticipantId, password, state.currentGroupId, state.currentParticipantToken);
                    alert('合言葉を設定しました。');
                    elements.passwordSetModal.style.display = 'none';
                } catch (error) {
                    alert(error.error);
                }
            }
        });
    });
    if(elements.participantLogoutButton) elements.participantLogoutButton.addEventListener('click', () => {
        state.clearParticipantState();
        window.location.reload();
    });
    if(elements.deleteMyAccountButton) elements.deleteMyAccountButton.addEventListener('click', async () => {
        if (!confirm('本当にこのグループからあなたのアカウントを削除しますか？\nこの操作は元に戻せません。')) return;
        try {
            await api.deleteMemberAccount(state.currentGroupId, state.currentParticipantId, state.currentParticipantToken);
            alert('アカウントを削除しました。');
            state.clearParticipantState();
            window.location.reload();
        } catch (error) {
            alert(`削除エラー: ${error.error}`);
        }
    });
    if(elements.slotList) elements.slotList.addEventListener('click', (e) => {
        const target = e.target.closest('.slot.available');
        if (!target) return;
        document.querySelectorAll('.slot.selected').forEach(el => el.classList.remove('selected'));
        target.classList.add('selected');
        state.setSelectedSlot(parseInt(target.dataset.slot, 10));
        if (elements.joinButton) elements.joinButton.disabled = false;
    });
    if(elements.joinButton) elements.joinButton.addEventListener('click', async () => {
        if (state.selectedSlot === null) return alert('参加枠を選択してください。');
        elements.joinButton.disabled = true;
        try {
            await api.joinSlot(state.currentEventId, state.currentParticipantId, state.currentParticipantToken, state.selectedSlot);
            await ui.showWaitingView();
        } catch (error) {
            alert(error.error);
        } finally {
            elements.joinButton.disabled = false;
        }
    });
    if(elements.shareButton) elements.shareButton.addEventListener('click', handleShareResult);
    if(elements.deleteParticipantWaitingButton) elements.deleteParticipantWaitingButton.addEventListener('click', async () => {
        if (!confirm('このイベントへの参加を取り消しますか？')) return;
        try {
            await api.deleteParticipant(state.currentEventId, state.currentParticipantToken);
            alert('参加を取り消しました。');
            window.location.reload();
        } catch(error) {
            alert(error.error);
        }
    });

    if(elements.editProfileButton) elements.editProfileButton.addEventListener('click', async () => {
        try {
            const memberData = await api.getMemberDetails(state.currentGroupId, state.currentParticipantId);
            ui.openProfileEditModal(memberData, {
                onSave: async () => {
                    elements.saveProfileButton.disabled = true;
                    try {
                        let newIconUrl = null;
                        const file = elements.profileIconInput.files[0];
                        if (file) {
                            const { signedUrl, iconUrl } = await api.generateUploadUrl(state.currentParticipantId, file.type, state.currentGroupId, state.currentParticipantToken);
                            await fetch(signedUrl, { method: 'PUT', headers: {'Content-Type': file.type}, body: file });
                            newIconUrl = iconUrl;
                        }
                        const profileData = { color: elements.profileColorInput.value };
                        if (newIconUrl) profileData.iconUrl = newIconUrl;

                        await api.updateProfile(state.currentParticipantId, profileData, state.currentGroupId, state.currentParticipantToken);
                        alert('プロフィールを保存しました。');
                        ui.closeProfileEditModal();
                    } catch (error) {
                        alert(error.error);
                    } finally {
                        elements.saveProfileButton.disabled = false;
                    }
                }
            });
        } catch (error) {
            alert(error.error);
        }
    });
    if(elements.profileIconInput) elements.profileIconInput.addEventListener('change', () => {
        const file = elements.profileIconInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { if(elements.profileIconPreview) elements.profileIconPreview.src = e.target.result; };
            reader.readAsDataURL(file);
        }
    });
    if(elements.prizeMasterSelectList) elements.prizeMasterSelectList.addEventListener('click', (e) => {
        const item = e.target.closest('li');
        if (item) {
            item.classList.toggle('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = item.classList.contains('selected');
        }
    });

    window.addEventListener('popstate', () => handleRouting({
        group: typeof initialGroupData !== 'undefined' ? initialGroupData : null,
        event: typeof initialEventData !== 'undefined' ? initialEventData : null,
    }));
    window.addEventListener('resize', ui.adjustBodyPadding);
    window.addEventListener('click', (event) => {
        if (elements.groupSettingsModal && event.target == elements.groupSettingsModal) ui.closeSettingsModal();
        if (elements.profileEditModal && event.target == elements.profileEditModal) ui.closeProfileEditModal();
        if (elements.passwordSetModal && event.target == elements.passwordSetModal) elements.passwordSetModal.style.display = 'none';
        if (elements.prizeMasterSelectModal && event.target == elements.prizeMasterSelectModal) ui.closePrizeMasterSelectModal();
        if (elements.groupDropdown && elements.groupDropdown.style.display === 'block' && !elements.groupSwitcher.contains(event.target)) {
            elements.groupDropdown.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);