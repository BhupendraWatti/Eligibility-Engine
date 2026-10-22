// The admin forms edit selection stages as plain text: one stage per line, "Stage name | what it involves".

export type SelectionStage = { stage?: number; name: string; desc: string; isQualifying?: boolean };

/** One line per stage, in order. Empty for none. */
export function formatSelectionStages(stages: SelectionStage[] | null | undefined): string {
  return (stages ?? []).map(s => (s.desc ? `${s.name} | ${s.desc}` : s.name)).join('\n');
}

/**
 * Reads the text back into stages, numbered in order. Blank lines are skipped; text after the first "|" is the
 * description. An unchanged stage keeps its stored "qualifying only" flag, which the text box cannot show.
 */
export function parseSelectionStages(text: string | null | undefined, previous: SelectionStage[] = []): SelectionStage[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const cut = line.indexOf('|');
      const name = (cut === -1 ? line : line.slice(0, cut)).trim();
      const desc = cut === -1 ? '' : line.slice(cut + 1).trim();
      const same = previous.find(p => p.name === name && (p.desc ?? '') === desc);
      return { stage: i + 1, name, desc, ...(same?.isQualifying !== undefined ? { isQualifying: same.isQualifying } : {}) };
    })
    .filter(s => s.name);
}
