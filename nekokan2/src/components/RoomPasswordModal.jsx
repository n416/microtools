import React, { useState } from 'react';
import { fetchRoomState } from '../api';

function RoomPasswordModal({ roomId, onClose, onSuccess, onToast, onCancel }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await fetchRoomState(roomId, password);
      onSuccess(result.state_json, password);
      onToast('ルームに入室しました！');
      onClose();
    } catch (e) {
      if (e.message === 'Unauthorized') {
         onToast('パスワードが間違っているか、入力が必要です。');
      } else {
         onToast('データ取得に失敗しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal" style={{display: 'flex'}}>
      <div className="modal-content">
        <h3>ルーム入室</h3>
        <p style={{fontSize: '14px', marginBottom: '15px'}}>このルームにはパスワードが設定されています。</p>
        <input 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="パスワード" 
          className="time-input" 
          style={{marginBottom: '15px', width: '100%', boxSizing: 'border-box'}}
        />
        <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
          <button className="btn" onClick={handleSubmit} disabled={isSubmitting}>入室する</button>
          <button className="btn clear-btn" onClick={() => {
            if (onCancel) onCancel();
            onClose();
          }}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

export default RoomPasswordModal;
