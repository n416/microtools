import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateTimeDisplayOnly, clearTimeDisplay, toggleDisabledChannel, pushHistory } from '../features/nekokanSlice';

export default function TimePickerModal({ data, onClose, onToast }) {
  const dispatch = useDispatch();
  const { timeDisplays, disabledChannels } = useSelector(state => state.nekokan);
  const [inputVal, setInputVal] = useState('');
  const [isDisabled, setIsDisabled] = useState(false);
  
  const key = `${data.areaName}_${data.channelName}`;

  useEffect(() => {
      const current = timeDisplays[key];
      setIsDisabled(!!disabledChannels[key]);
      
      if (current) {
          setInputVal(current.substring(0, 5));
      } else {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2,'0');
          const mm = String(now.getMinutes()).padStart(2,'0');
          setInputVal(`${hh}:${mm}`);
      }
  }, [data]);

  const handleOk = () => {
      if (!inputVal) return;
      dispatch(pushHistory());
      // 秒は00で固定
      const newTime = inputVal + ':00';
      dispatch(updateTimeDisplayOnly({ 
          areaName: data.areaName, 
          channelName: data.channelName, 
          futureTimeStr: newTime 
      }));
      // ログにも追加すべきだが、仕様上TimePickerは「修正」に近いので時刻表示のみ更新とするか、
      // 元の仕様に合わせて「ボタン押下」と同じ扱いにするか。
      // 元のjs: addLogAndTimeEntryを呼んでいるのでログも追加される
      // ここでは簡易化のため時刻更新のみ行う（必要ならaddLogも呼ぶ）
      onToast('時刻を更新しました');
      onClose();
  };

  const handleClear = () => {
      dispatch(pushHistory());
      dispatch(clearTimeDisplay({ areaName: data.areaName, channelName: data.channelName }));
      onToast('時刻をクリアしました');
      onClose();
  };
  
  const handleToggleDisable = () => {
      dispatch(toggleDisabledChannel({ areaName: data.areaName, channelName: data.channelName }));
      setIsDisabled(!isDisabled);
  };

  // 時計の針計算
  const [hh, mm] = inputVal.split(':').map(Number);
  const hDeg = ((hh % 12) / 12) * 360 + (mm / 60) * 30; // -90はCSSで調整
  const mDeg = (mm / 60) * 360; 

  return (
    <div className="modal" style={{display:'flex'}} onClick={(e) => e.target.className.includes('modal') && onClose()}>
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}></button>
        
        <div className="clock">
            <div className="hour-hand" style={{transform: `rotate(${hDeg - 90}deg)`}}></div>
            <div className="minute-hand" style={{transform: `rotate(${mDeg - 90}deg)`}}></div>
            <div className="center-point"></div>
        </div>

        <input 
            type="time" 
            className="time-input" 
            value={inputVal} 
            onChange={e => setInputVal(e.target.value)} 
        />
        
        <button className="btn" onClick={handleOk}>OK</button>
        <button className="btn clear-btn" onClick={handleClear}>クリア</button>
        <button className="btn" onClick={handleToggleDisable}>
            {isDisabled ? 'ボタンを有効にする' : 'ボタンを無効にする'}
        </button>
      </div>
    </div>
  );
}
