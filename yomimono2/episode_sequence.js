export function sortEpisodes(aName, bName) {
  const aClean = aName.replace(/\.mdx$/, '');
  const bClean = bName.replace(/\.mdx$/, '');

  // yomikiri は常に一番最初（プロローグ・短編扱い）
  if (aClean === 'yomikiri' && bClean !== 'yomikiri') return -1;
  if (bClean === 'yomikiri' && aClean !== 'yomikiri') return 1;
  if (aClean === 'yomikiri' && bClean === 'yomikiri') return 0;

  const isEpA = /^ep\d+$/.test(aClean);
  const isEpB = /^ep\d+$/.test(bClean);

  // 両方ともエピソード（ep〜）である場合（ゼロ埋め連番なので単純な文字列比較でソート可能）
  if (isEpA && isEpB) {
    return aClean.localeCompare(bClean);
  }

  // エピソード（ep〜）を他の設定ファイル群よりも前にする
  if (isEpA) return -1;
  if (isEpB) return 1;

  // どちらも設定ファイル等の場合は通常の文字列ソート
  return aClean.localeCompare(bClean, undefined, { numeric: true });
}
