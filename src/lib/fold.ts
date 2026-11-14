/**
 * Text folded for searching, so what is typed finds what is listed whatever
 * the accents, capitals and punctuation on either side: "levis" finds
 * "Centre de plein air de Lévis", and "bishop's" finds "Bishop’s" whichever
 * apostrophe the keyboard produced. Imports nothing, so Node can run it.
 *
 * SQLite's own LOWER() and LIKE only know the 26 unaccented letters, which is
 * why the folding is done here and the result stored beside each name.
 */
export function foldText(s: string): string {
  return s
    // Split each accented letter into the letter and its accent, then drop the accents.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Apostrophes vanish, so "d'Irène" and "d’Irene" both read "direne".
    .replace(/['‘’`´]/g, '')
    // Everything else that is not a letter or a digit separates words.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** What a ski area is searched by: its name, town and region, folded. */
export function searchText(name: string, locality: string | null, regionName: string | null): string {
  return foldText([name, locality, regionName].filter(Boolean).join(' '));
}
