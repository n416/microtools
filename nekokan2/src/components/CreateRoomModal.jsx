import React, { useState } from 'react';
import { createRoom } from '../api';
import { useSelector } from 'react-redux';

function CreateRoomModal({ onClose, onToast, onRoomCreated }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const state = useSelector(s => s.nekokan);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data = {
        logs: state.logs,
        timeDisplays: state.timeDisplays,
        channelCounts: state.channelCounts,
        disabledChannels: state.disabledChannels
      };
      const result = await createRoom(JSON.stringify(data), password);
      localStorage.setItem('nekokan2_owner_' + result.room_id, result.owner_token);
      onRoomCreated(result.room_id, password);
      onToast('ルームを作成しました！');
      onClose();
    } catch (e) {
      onToast('ルーム作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal" style={{display: 'flex'}}>
      <div className="modal-content">
        <h3>ルームを作成 (共有)</h3>
        <p style={{fontSize: '14px', marginBottom: '15px'}}>
          現在の状態を共有するためのURLを発行します。<br/>パスワードを設定する場合は入力してください。（空欄で公開）
        </p>
        <input 
          type="text" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="パスワード（任意）" 
          className="time-input" 
          style={{marginBottom: '15px', width: '100%', boxSizing: 'border-box'}}
        />
        <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
          <button className="btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '作成中...' : '作成する'}
          </button>
          <button className="btn clear-btn" onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

export default CreateRoomModal;
