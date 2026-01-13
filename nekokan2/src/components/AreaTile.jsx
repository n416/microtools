import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addLog, pushHistory } from '../features/nekokanSlice';

export default function AreaTile({ area, onOpenTimePicker, onOpenSettings, onLogAdded }) {
  const dispatch = useDispatch();
  const { timeDisplays, channelCounts, defaultChannelCount, disabledChannels, highlightTarget, hoverTarget } = useSelector(state => state.nekokan);
  
  // このエリアのチャンネル数
  const count = channelCounts[area.name] || defaultChannelCount;
  
  const handleLogClick = (channel) => {
    dispatch(pushHistory());

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // 1時間後
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    const futureStr = future.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    dispatch(addLog({
        areaName: area.name,
        channelName: channel,
        timeStr: timeStr,
        futureTimeStr: futureStr
    }));
    
    onLogAdded(`${area.name} ${channel}のログを追加しました`);
  };

  // チャンネルリスト生成
  const channels = ['PVP'];
  for(let i=1; i<=count; i++) channels.push(`ch${i}`);

  return (
    <div className={`area-tile ${area.class}`}>
      <div className="area-title" onClick={() => onOpenSettings(area.name)}>{area.name}</div>
      {channels.map(ch => {
        const key = `${area.name}_${ch}`;
        const timeDisplay = timeDisplays[key];
        const isDisabled = disabledChannels[key];

        // 判定: クリックによる点滅ターゲット
        const isBlinking = highlightTarget && highlightTarget.area === area.name && highlightTarget.channel === ch;
        // 判定: マウスホバーによるハイライトターゲット
        const isHovered = hoverTarget && hoverTarget.area === area.name && hoverTarget.channel === ch;

        // クラスの決定 (点滅優先)
        let rowClass = 'log-row';
        if (isBlinking) {
            rowClass += ' log-row-blink';
        } else if (isHovered) {
            rowClass += ' log-row-highlight';
        }

        return (
            <div key={ch} className={rowClass}>
                <div className="log-label" onClick={() => onOpenTimePicker(area.name, ch)}>
                    {ch}
                    {timeDisplay && (
                        <div className="time-display">
                            <i className="far fa-clock"></i>&nbsp;{timeDisplay.substring(0, 5)}
                        </div>
                    )}
                </div>
                <div className="log-button-container">
                    <LogButton 
                        onClick={() => handleLogClick(ch)} 
                        hasTime={!!timeDisplay} 
                        disabled={isDisabled}
                    />
                </div>
            </div>
        );
      })}
    </div>
  );
}

function LogButton({ onClick, hasTime, disabled }) {
    const iconClass = hasTime ? 'fa-skull-crossbones' : 'fa-cat';

    return (
        <button 
            className={`btn log-btn ${disabled ? 'disabled-log-btn' : ''}`} 
            disabled={disabled}
            onClick={onClick}
        >
            {hasTime && iconClass === 'fa-skull-crossbones' && '!'}
            <i className={`fas ${iconClass}`}></i>
        </button>
    );
}
