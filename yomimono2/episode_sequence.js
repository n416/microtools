export function sortEpisodes(aName, bName) {
  const aClean = aName.replace(/\.mdx$/, '');
  const bClean = bName.replace(/\.mdx$/, '');

  // yomikiri は常に一番最初（プロローグ・短編扱い）
  if (aClean === 'yomikiri' && bClean !== 'yomikiri') return -1;
  if (bClean === 'yomikiri' && aClean !== 'yomikiri') return 1;
  if (aClean === 'yomikiri' && bClean === 'yomikiri') return 0;

  // ep0010, ep0010_5 の数値を抽出するヘルパー
  const parseEp = (name) => {
    const match = name.match(/^ep(\d+)(_(\d+))?$/);
    if (!match) return null; // plot, character等の設定ファイル
    const mainNum = parseInt(match[1], 10);
    const subNum = match[3] ? parseInt(match[3], 10) : 0;
    return mainNum + (subNum / 100); // 10.05 のようにして比較
  };

  const aVal = parseEp(aClean);
  const bVal = parseEp(bClean);

  // 両方ともエピソード（ep〜）である場合
  if (aVal !== null && bVal !== null) {
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  
  // エピソード（ep〜）を他の設定ファイル群よりも前にする
  if (aVal !== null) return -1;
  if (bVal !== null) return 1;

  // どちらも設定ファイル等の場合は通常の文字列ソート
  return aClean.localeCompare(bClean, undefined, { numeric: true });
}
