import React, { useState } from 'react';
import { changeRoomPassword } from '../api';

function ChangePasswordModal({ roomId, onClose, onToast, onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const ownerToken = localStorage.getItem('nekokan2_owner_' + roomId);
      await changeRoomPassword(roomId, ownerToken, newPassword);
      onPasswordChanged(newPassword);
      onToast('パスワードを変更しました！');
      onClose();
    } catch (e) {
      if (e.message === 'Unauthorized') {
         onToast('権限がありません。部屋主のみが変更できます。');
      } else {
         onToast('パスワードの変更に失敗しました。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal" style={{display: 'flex'}}>
      <div className="modal-content">
        <h3>パスワード変更</h3>
        <p style={{fontSize: '14px', marginBottom: '15px'}}>
          ルームの新しいパスワードを入力してください。<br/>（空欄にするとパスワードなしになります）
        </p>
        <input 
          type="text" 
          value={newPassword} 
          onChange={e => setNewPassword(e.target.value)} 
          placeholder="新しいパスワード" 
          className="time-input" 
          style={{marginBottom: '15px', width: '100%', boxSizing: 'border-box'}}
        />
        <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
          <button className="btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '変更中...' : '変更する'}
          </button>
          <button className="btn clear-btn" onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
