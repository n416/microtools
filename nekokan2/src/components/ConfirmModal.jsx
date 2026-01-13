import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setDefaultChannelCount } from '../features/nekokanSlice';

export function DefaultChannelSettingsModal({ onClose, onToast }) {
  const dispatch = useDispatch();
  const def = useSelector(state => state.nekokan.defaultChannelCount);
  const [val, setVal] = useState(def);

  return (
    <div className="modal" style={{display:'flex'}} onClick={(e) => e.target.className.includes('modal') && onClose()}>
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}></button>
        <label>デフォルトチャンネル数 (1〜6):</label>
        <input type="number" className="time-input" min="1" max="6" value={val} onChange={e => setVal(e.target.value)} />
        <button className="btn" onClick={() => {
            dispatch(setDefaultChannelCount(parseInt(val, 10)));
            onToast('設定しました');
            onClose();
        }}>OK</button>
      </div>
    </div>
  );
}

export default function ConfirmModal({ message, onConfirm, onCancel, yesText="はい", noText="いいえ" }) {
  return (
    <div className="modal" style={{display:'flex'}} onClick={(e) => e.target.className.includes('modal') && onCancel()}>
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onCancel}></button>
        <p>{message}</p>
        <button className="btn" onClick={onConfirm}>{yesText}</button>
        <button className="btn" onClick={onCancel}>{noText}</button>
      </div>
    </div>
  );
}
