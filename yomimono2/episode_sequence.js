export const episodeSequence = [
  'ep0000',
  'ep0010',
  'ep0020',
  'ep0030',
  'ep0040',
  'ep0040_5',
  'ep0050',
  'ep0050_5',
  'ep0051',
  'ep0052',
  'ep0060',
  'ep0060_5',
  'ep0070',
  'ep0080',
  'ep0085',
  'ep0085_5',
  'ep0087',
  'ep0088',
  'ep0089',
  'ep0090',
  'ep0100',
  'ep0105',
  'ep0105_5',
  'ep0106',
  'ep0107',
  'ep0108',
  'ep0108_5',
  'ep0109',
  'ep0110',
  'ep0115',
  'ep0118',
  'ep0120',
  'ep0130',
  'ep0140',
  'ep0150',
  'ep0160',
  'ep0170',
  'ep0180',
  'ep0190',
  'ep0200'
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
