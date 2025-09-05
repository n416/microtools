// amidakuji-app/utils/emoji-map.js

const emojiMap = new Map([
  ['🏠', 'home'],
  ['👤', 'user-circle'],
  ['❔', 'help-circle'],
  ['⚙️', 'settings'],
  ['🏆', 'trophy'],
  ['👥', 'users'],
  ['🎉', 'party-popper'],
  ['🔄', 'refresh-cw'],
  ['🎁', 'gift'],
  ['＋', 'plus'],
  ['×', 'x'],
  ['←', 'arrow-left'],
  ['？', 'image-off'],
  ['▼', 'chevron-down'],
  ['🖼️', 'images'],
  ['❓', 'message-circle-question-mark'],
]);

// module.exportsオブジェクトを置き換えるのではなく、プロパティとして追加する
module.exports.emojiMap = emojiMap;

module.exports.emojiToLucide = (emoji) => {
  return emojiMap.get(emoji) || '';
};
