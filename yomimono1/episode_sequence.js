export const episodeSequence = [
  'ep0000', 'ep0100', 'ep0200', 'ep0300', 'ep0400', 'ep0450',
  'ep0500', 'ep0600', 'ep0650', 'ep0660', 'ep0700', 'ep0800', 'ep0900'
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
