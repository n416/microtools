// js/router.js
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import { startAnimation, stopAnimation } from './animation.js';

async function initializeParticipantView(eventId, isShare, sharedParticipantName) {
    ui.hideParticipantSubViews();
    if (ui.elements.otherEventsSection) ui.elements.otherEventsSection.style.display = 'none';

    try {
        state.setCurrentEventId(eventId);
        const eventData = isShare
            ? await api.getPublicShareData(eventId)
            : await api.getPublicEventData(eventId);
        
        state.setCurrentLotteryData(eventData);
        state.setCurrentGroupId(eventData.groupId);
        state.loadParticipantState();

        if (ui.elements.participantEventName) ui.elements.participantEventName.textContent = eventData.eventName || 'あみだくじイベント';

        const backLink = document.getElementById('backToGroupEventListLink');
        if (backLink) {
            try {
                const groupData = await api.getGroup(eventData.groupId);
                if (groupData) {
                    const backUrl = groupData.customUrl ? `/g/${groupData.customUrl}` : `/groups/${groupData.id}`;
                    backLink.href = backUrl;
                    backLink.textContent = `← ${groupData.name}のイベント一覧に戻る`;
                    backLink.style.display = 'inline-block';
                } else {
                    backLink.style.display = 'none';
                }
            } catch (groupError) {
                console.error("Failed to get group info for back link:", groupError);
                backLink.style.display = 'none';
            }
        }
        
        if (eventData.otherEvents) {
            ui.renderOtherEvents(eventData.otherEvents);
        }

        if (isShare) {
            await showResultsView(eventData, sharedParticipantName, true);
        } else if (state.currentParticipantToken && state.currentParticipantId) {
            if (eventData.status === 'started') {
                await showResultsView(eventData, state.currentParticipantName, false);
            } else {
                ui.showControlPanelView(eventData);
            }
        } else {
            ui.showNameEntryView();
        }

    } catch (error) {
        console.error('Error in initializeParticipantView:', error);
        if (error.requiresPassword) {
            state.setLastFailedAction(() => initializeParticipantView(eventId, isShare, sharedParticipantName));
            ui.showGroupPasswordModal(error.groupId, error.groupName);
        } else {
            if (ui.elements.participantView) ui.elements.participantView.innerHTML = `<div class="view-container"><p class="error-message">${error.error || error.message}</p></div>`;
        }
    }
}

// ▼▼▼▼▼ ここからが今回の修正箇所です ▼▼▼▼▼
async function initializeGroupEventListView(customUrlOrGroupId, groupData) {
    const { groupEventListContainer, groupNameTitle } = ui.elements;
    if (!groupEventListContainer || !groupNameTitle) return;

    if (groupData) {
        groupNameTitle.textContent = `${groupData.name} のイベント一覧`;
    }

    try {
        const events = groupData && groupData.customUrl 
            ? await api.getEventsByCustomUrl(customUrlOrGroupId)
            : await api.getPublicEventsForGroup(customUrlOrGroupId); // admin用ではなく、公開用のAPIを呼び出す

        groupEventListContainer.innerHTML = '';
        if (events.length === 0) {
            groupEventListContainer.innerHTML = '<li class="item-list-item">現在参加できるイベントはありません。</li>';
            return;
        }

        events.forEach((event) => {
            const li = document.createElement('li');
            li.className = 'item-list-item';
            const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
            
            const eventUrl = groupData && groupData.customUrl 
                ? `/g/${groupData.customUrl}/${event.id}` 
                : `/events/${event.id}`;

            li.innerHTML = `
                <span><strong>${event.eventName || '無題のイベント'}</strong>（${date.toLocaleDateString()} 作成）</span>
                <a href="${eventUrl}" class="button">このイベントに参加する</a>
            `;
            groupEventListContainer.appendChild(li);
        });
    } catch (error) {
        console.error(error);
        if (error.requiresPassword) {
            state.setLastFailedAction(() => initializeGroupEventListView(customUrlOrGroupId, groupData));
            ui.showGroupPasswordModal(error.groupId, error.groupName);
        } else {
            groupEventListContainer.innerHTML = `<li class="error-message">${error.error || error.message}</li>`;
        }
    }
}
// ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲

async function showResultsView(eventData, targetName, isShareView) {
    ui.showResultsView();
    const onAnimationComplete = () => {
        const result = eventData.results ? eventData.results[targetName] : null;
        if (result) {
            const prizeName = typeof result.prize === 'object' ? result.prize.name : result.prize;
            if (ui.elements.myResult) ui.elements.myResult.innerHTML = `<b>${targetName}さんの結果は…「${prizeName}」でした！</b>`;
        } else {
            if (ui.elements.myResult) ui.elements.myResult.textContent = 'まだ結果は発表されていません。';
        }
        if (!isShareView) {
            if(ui.elements.shareButton) ui.elements.shareButton.style.display = 'block';
            if(ui.elements.backToControlPanelFromResultButton) ui.elements.backToControlPanelFromResultButton.style.display = 'block';
        }
        if (eventData.results) {
            ui.renderAllResults(eventData.results);
        }
    };
    if (ui.elements.myResult) ui.elements.myResult.innerHTML = `<b>${targetName}さんの結果をアニメーションで確認中...</b>`;
    const ctxParticipant = ui.elements.participantCanvas ? ui.elements.participantCanvas.getContext('2d') : null;
    await startAnimation(ctxParticipant, [targetName], onAnimationComplete);
}


export async function handleRouting(initialData) {
    stopAnimation();
    const path = window.location.pathname;

    const groupEventListMatch = path.match(/\/g\/(.+?)\/?$/);
    const eventFromGroupMatch = path.match(/\/g\/(.+?)\/([a-zA-Z0-9]+)/);
    const directEventMatch = path.match(/\/events\/([a-zA-Z0-9]+)/);
    const shareMatch = path.match(/\/share\/([a-zA-Z0-9]+)\/(.+)/);
    const adminMatch = path.match(/\/admin/);
    const groupByIdMatch = path.match(/\/groups\/([a-zA-Z0-9]+)\/?$/);

    const isParticipantView = groupEventListMatch || eventFromGroupMatch || shareMatch || directEventMatch || groupByIdMatch;

    if (isParticipantView) {
        if(ui.elements.mainHeader) ui.elements.mainHeader.style.display = 'none';
        
        if (groupEventListMatch && !eventFromGroupMatch || groupByIdMatch) { 
            const customUrlOrGroupId = groupEventListMatch ? groupEventListMatch[1] : groupByIdMatch[1];
            ui.showView('groupEventListView');

            let groupDataObject = null;
            if (initialData && initialData.group) {
                if (typeof initialData.group === 'string') {
                    try {
                        groupDataObject = JSON.parse(initialData.group);
                    } catch (e) {
                        console.error("Failed to parse groupData JSON string:", e);
                    }
                } else if (typeof initialData.group === 'object') {
                    groupDataObject = initialData.group;
                }
            } else {
                 try {
                    groupDataObject = groupEventListMatch 
                        ? await api.getGroupByCustomUrl(customUrlOrGroupId) // このAPIも必要になります
                        : await api.getGroup(customUrlOrGroupId);
                 } catch(e) {
                     console.error("Failed to fetch group data", e);
                 }
            }
            await initializeGroupEventListView(customUrlOrGroupId, groupDataObject);

        } else {
            ui.showView('participantView');
            let eventId, participantName;
            if (eventFromGroupMatch) eventId = eventFromGroupMatch[2];
            if (directEventMatch) eventId = directEventMatch[1];
            if (shareMatch) [ , eventId, participantName] = shareMatch;
            
            await initializeParticipantView(eventId, !!shareMatch, participantName ? decodeURIComponent(participantName) : null);
        }
        return;
    }

    if(ui.elements.mainHeader) ui.elements.mainHeader.style.display = 'flex';
    
    const user = await api.checkGoogleAuthState().catch(() => null);
    state.setCurrentUser(user);
    ui.updateAuthUI(user);
    
    if (user) {
        if (adminMatch && user.role === 'system_admin' && !user.isImpersonating) {
            ui.showView('adminDashboard');
        } else if (path === '/admin') {
            window.location.href = '/';
        }
    } else {
        ui.showView(null);
    }
    ui.adjustBodyPadding();
}