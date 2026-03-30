export const episodeSequence = [
  'ep0000',
  'ep0010',
  'ep0020',
  'ep0030',
  'ep0040',
  'ep0050',
  'ep0052',
  'ep0055',
  'ep0060',
  'ep0070',
  'ep0080',
  'ep0085',
  'ep0087',
  'ep0090',
  'ep0100',
  'ep0110',
  'ep0120',
  'ep0130',
  'ep0140',
  'ep0150',
  'ep0160'
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
