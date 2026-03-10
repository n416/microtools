export const episodeSequence = [
  'prologue1', 'prologue2', 'prologue3',
  'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep5_5', 'ep6', 
  'ep7_1', 'ep7_2', 'ep7_3', 'ep8', 
  'ep9_0', 'ep9_1', 'ep9_2',
  'ep10_0', 'ep10_1', 'ep10_2', 'ep10_3', 'ep10_4', 'ep10_5', 'ep10_6', 'ep10_7',
  'ep11', 'ep11_1', 'ep11_2',
  'ep12', 'ep13', 'ep13_2', 
  'ep13_3', 'ep13_4', 
  'ep14', 'ep14_5', 'ep15',
  'ep16_1', 'ep16_2', 'ep16_3', 'ep16_4', 
  'ep17', 'ep18', 'ep19'
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
