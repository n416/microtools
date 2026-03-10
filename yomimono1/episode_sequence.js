// episode_sequence.js
export const episodeSequence = [
  'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7', 'ep8', 'ep8_5', 'ep9',
  'ep10_1', 'ep10_2', 'ep10_3', 'ep11', 'ep12_0', 'ep12_1', 'ep12_2',
  'ep13_0', 'ep13_1', 'ep13_2', 'ep13_3', 'ep13_4', 'ep13_5', 'ep13_6', 'ep13_7',
  'ep14', 'ep14_1', 'ep14_2', 'ep15', 'ep15_5', 'ep16_0', 'ep16_0_5', 'lore_lin_hidden', 'ep16_0_6', 'ep16_1', 'ep17', 'ep17_5', 'lore_kurosu_hidden', 'ep18', 'ep19_1', 'ep19_2', 'ep19_3', 'ep19_4', 'ep20', 'ep21', 'ep22'
];

export function sortEpisodes(aName, bName) {
  const aClean = aName.replace(/\.mdx$/, '');
  const bClean = bName.replace(/\.mdx$/, '');
  
  const aIndex = episodeSequence.indexOf(aClean);
  const bIndex = episodeSequence.indexOf(bClean);

  if (aIndex !== -1 && bIndex !== -1) {
    return aIndex - bIndex;
  }
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;

  return aName.localeCompare(bName, undefined, { numeric: true });
}
