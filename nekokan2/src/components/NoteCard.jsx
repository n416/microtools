import React, { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setHighlightTarget, setHoverTarget } from '../features/nekokanSlice';

export default function NoteCard() {
  const dispatch = useDispatch();
  const { timeDisplays, showSeconds, hideTime } = useSelector(state => state.nekokan);

  // ログエントリの生成とソート
  const entries = useMemo(() => {
    const arr = [];
    const now = new Date();
    const fiveMin = 5 * 60 * 1000;
    
    Object.entries(timeDisplays).forEach(([key, timeStr]) => {
        const [area, channel] = key.split('_');
        const logTime = new Date(now.toDateString() + ' ' + timeStr);
        const diff = logTime - now;
        
        let className = '';
        if (diff > -fiveMin && diff <= fiveMin) {
            className = 'soon-log';
        } else if (diff <= -fiveMin) {
            className = 'past-log';
        }
        
        arr.push({
            key, area, channel, timeStr, logTime, className, diff
        });
    });

    arr.sort((a, b) => a.timeStr.localeCompare(b.timeStr));

    const future = arr.find(e => e.diff > 0);
    if (future) future.className += ' closest-log';
    
    return arr;
  }, [timeDisplays]);

  // 表示用フォーマット
  const renderEntries = () => {
    let lastArea = null;
    return entries.map((entry, index) => {
        const showSeparator = lastArea !== entry.area;
        lastArea = entry.area;
        
        let timePart = '';
        if (!hideTime) {
            timePart = showSeconds ? entry.timeStr : entry.timeStr.substring(0, 5);
        }

        return (
            <React.Fragment key={entry.key}>
                {index > 0 && showSeparator && <hr />}
                {index > 0 && !showSeparator && ' → '}
                
                <span 
                    className={`${entry.className}`}
                    style={{ cursor: 'pointer' }}
                    // クリック時: 点滅アニメーション
                    onClick={() => {
                        dispatch(setHighlightTarget({ area: entry.area, channel: entry.channel }));
                        setTimeout(() => {
                            dispatch(setHighlightTarget(null));
                        }, 3000);
                    }}
                    // ホバー時: 背景色ハイライト
                    onMouseEnter={() => {
                        dispatch(setHoverTarget({ area: entry.area, channel: entry.channel }));
                    }}
                    onMouseLeave={() => {
                        dispatch(setHoverTarget(null));
                    }}
                >
                    {showSeparator ? `${entry.area} ${entry.channel}` : entry.channel}
                    {timePart && ` ${timePart}`}
                </span>
            </React.Fragment>
        );
    });
  };

  return (
    <div id="noteCard" className={`area-tile ${entries.length > 0 ? 'active' : ''}`}>
        {renderEntries()}
    </div>
  );
}
