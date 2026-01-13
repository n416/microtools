import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import LZString from 'lz-string';
import { 
  addLog, undo, redo, resetAll, pushHistory, 
  loadFromUrl, updateAlarmSettings, toggleShowSeconds, toggleHideTime 
} from './features/nekokanSlice';
import AreaTile from './components/AreaTile';
import NoteCard from './components/NoteCard';
import TimePickerModal from './components/TimePickerModal';
import ChannelSettingsModal from './components/ChannelSettingsModal';
import DefaultChannelSettingsModal from './components/DefaultChannelSettingsModal';
import ConfirmModal from './components/ConfirmModal';
import { useAudioAlarm } from './hooks/useAudioAlarm';
import { useTitleNotification } from './hooks/useTitleNotification'; // 追加
import './App.css';

function App() {
  const dispatch = useDispatch();
  const { areas, logs, alarmSettings, showSeconds, hideTime } = useSelector(state => state.nekokan);
  const [toastMessage, setToastMessage] = useState('');
  
  const [activeModal, setActiveModal] = useState(null); 
  const [modalData, setModalData] = useState(null);

  useAudioAlarm(); 
  useTitleNotification(); // 追加: タイトル通知機能

  // URLパラメータロード
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    if (data && logs.length > 0) {
        setActiveModal('overwrite');
        setModalData(data);
    } else if (data) {
        dispatch(loadFromUrl(data));
        window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // ショートカットキー (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                dispatch(undo());
                showToast('Undo');
            } else if (e.key === 'y') {
                e.preventDefault();
                dispatch(redo());
                showToast('Redo');
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleResetAll = () => {
    if (confirm('全てのデータと設定をリセットしますか？')) {
        localStorage.clear();
        window.location.reload();
    }
  };

  const handleShare = async () => {
    const state = await import('./store/store').then(m => m.store.getState().nekokan);
    const data = { 
        logs: state.logs, 
        timeDisplays: state.timeDisplays, 
        channelCounts: state.channelCounts 
    };
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
    
    if (navigator.share) {
        try { await navigator.share({ title: 'NEKO-KAN', url }); } catch(e) {}
    } else {
        navigator.clipboard.writeText(url);
    }
    showToast('シェア/コピーしました');
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="top-left-align">
            <button className="header-btn" onClick={handleResetAll} title="全リセット"><i className="fas fa-trash"></i></button>
            <button className="header-btn" onClick={() => dispatch(undo())} title="元に戻す"><i className="fas fa-arrow-rotate-left"></i></button>
            <button className="header-btn" onClick={() => dispatch(redo())} title="やり直す"><i className="fas fa-redo"></i></button>
            <button className="header-btn" onClick={handleShare} title="共有"><i className="fas fa-share-alt"></i></button>
        </div>
        <div className="title" onClick={() => setActiveModal('defaultChannel')}>NEKO-KAN 2</div>
      </div>

      {/* Main Screen */}
      <>
            <div className="area-container">
                {areas.map(area => (
                    <AreaTile 
                        key={area.id} 
                        area={area} 
                        onOpenTimePicker={(areaName, channelName, btnRef) => {
                            setActiveModal('timePicker');
                            setModalData({ areaName, channelName });
                        }}
                        onOpenSettings={(areaName) => {
                            setActiveModal('channelSettings');
                            setModalData({ areaName });
                        }}
                        onLogAdded={(msg) => showToast(msg)}
                    />
                ))}
            </div>

            <div className="bottom-section">
                <div className="note-wrapper">
                    <div id="digitalClock"><DigitalClock /></div>
                    
                    <NoteCard />
                    
                    <div className="note-controls">
                        <div id="toggleTimeDisplay" onClick={() => dispatch(toggleHideTime())} style={{display:'flex', alignItems:'center', cursor:'pointer', marginBottom:'5px'}}>
                            <i className={`fa-regular ${hideTime ? 'fa-square-check' : 'fa-square'}`} style={{width:'20px', textAlign:'center', marginRight:'5px'}}></i> 時刻非表示
                        </div>
                        <div id="toggleSecondsDisplay" onClick={() => dispatch(toggleShowSeconds())} style={{display:'flex', alignItems:'center', cursor:'pointer'}}>
                            <i className={`fa-regular ${showSeconds ? 'fa-square-check' : 'fa-square'}`} style={{width:'20px', textAlign:'center', marginRight:'5px'}}></i> 秒表示
                        </div>
                    </div>
                </div>

                <div className="alarm-settings">
                    <label><input type="checkbox" checked={alarmSettings.alarm1min} onChange={e => dispatch(updateAlarmSettings({alarm1min: e.target.checked}))} /> 1分前</label>
                    <label><input type="checkbox" checked={alarmSettings.alarm3min} onChange={e => dispatch(updateAlarmSettings({alarm3min: e.target.checked}))} /> 3分前</label>
                    <label><input type="checkbox" checked={alarmSettings.alarm5min} onChange={e => dispatch(updateAlarmSettings({alarm5min: e.target.checked}))} /> 5分前</label>
                    <label><input type="checkbox" checked={alarmSettings.muted} onChange={e => dispatch(updateAlarmSettings({muted: e.target.checked}))} /> 鳴らさない</label>
                </div>
            </div>
          </>

      <div className={`toast ${toastMessage ? 'show' : ''}`}>{toastMessage}</div>

      {activeModal === 'timePicker' && (
          <TimePickerModal 
            data={modalData} 
            onClose={() => setActiveModal(null)} 
            onToast={showToast}
          />
      )}
      {activeModal === 'channelSettings' && (
          <ChannelSettingsModal 
             areaName={modalData.areaName} 
             onClose={() => setActiveModal(null)} 
             onToast={showToast}
          />
      )}
      {activeModal === 'defaultChannel' && (
          <DefaultChannelSettingsModal onClose={() => setActiveModal(null)} onToast={showToast} />
      )}
      {activeModal === 'overwrite' && (
          <ConfirmModal 
            message="データが含まれています。上書きしますか？"
            onConfirm={() => {
                dispatch(loadFromUrl(modalData));
                window.history.replaceState(null, '', window.location.pathname);
                setActiveModal(null);
                showToast('ロードしました');
            }}
            onCancel={() => {
                window.history.replaceState(null, '', window.location.pathname);
                setActiveModal(null);
            }}
            yesText="上書き"
            noText="キャンセル"
          />
      )}
    </div>
  );
}

function DigitalClock() {
    const [time, setTime] = useState('');
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setTime(now.toLocaleTimeString('ja-JP', {hour12: false}));
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    return <>{time}</>;
}

export default App;
