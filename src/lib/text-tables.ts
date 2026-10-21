/**
 * Notice text fields (overview, salary, qualification, relaxation notes...) are shown as plain text with
 * line breaks kept. The one structure they may carry is a pipe table, so post-wise pay or vacancies read
 * as a table instead of raw "| a | b |" lines:
 *
 *   | Post | Pay Level | Vacancies |
 *   |---|---|---|
 *   | Goods Train Manager | 5 | 2750 |
 *
 * Cells are plain text; the page escapes them, so no HTML can be injected.
 */

/** How an AI client must write a table in a text field (shown in get_domain_schema and refusals). */
export const TABLE_FORMAT =
  'Text fields are plain text with line breaks kept; the only structure they show is a pipe table. For a table (post-wise pay, vacancies, ' +
  'medical standards, fees...) write the header row, then a separator line with one "---" per column, then one row per line, every row starting ' +
  'and ending with "|" and having the same number of cells as the header, e.g. "| Post | Pay Level | Vacancies |\\n|---|---|---|\\n| Goods Train Manager | 5 | 2750 |". ' +
  'Leave a blank line before and after the table. No other Markdown (no **bold**, # headings or HTML); cells are plain text.';

export type TextBlock =
  | { kind: 'text'; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] };

const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line: string) => /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
const cells = (line: string) => line.trim().slice(1, -1).split('|').map(c => c.trim());

interface Parsed { blocks: TextBlock[]; problems: string[] }

function parse(text: string): Parsed {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: TextBlock[] = [];
  const problems: string[] = [];
  let pending: string[] = [];
  const flush = () => {
    const t = pending.join('\n').trim();
    if (t) blocks.push({ kind: 'text', text: t });
    pending = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isRow(line) && !isSeparator(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = cells(line);
      if (cells(lines[i + 1]).length !== header.length) {
        problems.push(`the separator under "${line.trim()}" must have one "---" per column (${header.length})`);
      }
      const rows: string[][] = [];
      i += 2;
      for (; i < lines.length && isRow(lines[i]); i++) {
        const row = cells(lines[i]);
        if (isSeparator(lines[i])) problems.push(`"${lines[i].trim()}" is a second separator line inside one table`);
        else if (row.length !== header.length) problems.push(`row "${lines[i].trim()}" has ${row.length} cells, the header has ${header.length}`);
        rows.push(header.map((_, c) => row[c] ?? ''));
      }
      i--;
      flush();
      blocks.push({ kind: 'table', header, rows });
      continue;
    }
    if (isRow(line) || isSeparator(line)) problems.push(`"${line.trim()}" looks like a table row but is not under a header row followed by a |---| separator line`);
    pending.push(line);
  }
  flush();
  return { blocks, problems };
}

/** Plain-text paragraphs and tables, in order, for the page to render. */
export function splitTextBlocks(text: string | null | undefined): TextBlock[] {
  return text ? parse(text).blocks : [];
}

/** Why a text field's table would show as raw pipes or a broken grid; empty when it is fine. */
export function tableProblems(text: string): string[] {
  return parse(text).problems;
}
