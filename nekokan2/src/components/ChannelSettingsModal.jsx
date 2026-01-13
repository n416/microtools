import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setChannelCount, clearAreaLogs, pushHistory } from '../features/nekokanSlice';

export default function ChannelSettingsModal({ areaName, onClose, onToast }) {
  const dispatch = useDispatch();
  const currentCount = useSelector(state => state.nekokan.channelCounts[areaName]) || useSelector(state => state.nekokan.defaultChannelCount);
  const [val, setVal] = useState(currentCount);

  const handleOk = () => {
      if (val >= 1 && val <= 10) {
          dispatch(setChannelCount({ areaName, count: parseInt(val, 10) }));
          onClose();
      }
  };
  
  const handleClear = () => {
      dispatch(pushHistory());
      dispatch(clearAreaLogs({ areaName }));
      onToast(`${areaName}の全時刻ログをクリアしました`);
      onClose();
  };

  return (
    <div className="modal" style={{display:'flex'}} onClick={(e) => e.target.className.includes('modal') && onClose()}>
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}></button>
        <label>チャンネル数 (1〜10):</label>
        <input type="number" className="time-input" min="1" max="10" value={val} onChange={e => setVal(e.target.value)} />
        <button className="btn" onClick={handleOk}>OK</button>
        <button className="btn clear-btn" onClick={handleClear}>クリア</button>
      </div>
    </div>
  );
}
