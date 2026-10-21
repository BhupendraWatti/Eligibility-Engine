/**
 * Pipe tables in notice text fields. Run: `tsx src/lib/text-tables.test.ts`.
 */
import { splitTextBlocks, tableProblems } from './text-tables';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`PASSED: ${msg}`);
}

// The RRB NTPC CEN 06/2026 pay table that showed as raw pipes.
const ntpc = [
  'Initial pay by post:',
  '',
  '| Post | Pay Level (7th CPC) | Initial pay | Medical standard | Vacancies |',
  '|---|---|---|---|---|',
  '| Chief Commercial Cum Ticket Supervisor | 6 | Rs. 35,400 | B2 | 127 |',
  '| Goods Train Manager | 5 | Rs. 29,200 | A2 | 2750 |',
  '| Junior Accounts Assistant cum Typist | 5 | Rs. 29,200 | C2 | 300 |',
  '| Senior Clerk cum Typist | 5 | Rs. 29,200 | C2 | 371 |',
  '',
  'Allowances as per Railway rules.',
].join('\n');
{
  const blocks = splitTextBlocks(ntpc);
  assert(blocks.length === 3, 'text, table, text');
  assert(blocks[0].kind === 'text' && blocks[0].text === 'Initial pay by post:', 'the text before the table is kept');
  const table = blocks[1];
  assert(table.kind === 'table' && table.header.length === 5 && table.header[1] === 'Pay Level (7th CPC)', 'the header row becomes the table head');
  assert(table.kind === 'table' && table.rows.length === 4 && table.rows[1][0] === 'Goods Train Manager' && table.rows[1][4] === '2750', 'each row becomes a table row with its cells');
  assert(blocks[2].kind === 'text' && blocks[2].text === 'Allowances as per Railway rules.', 'the text after the table is kept');
  assert(tableProblems(ntpc).length === 0, 'a well-formed table has no problems');
}

assert(splitTextBlocks('Line one\nLine two').length === 1, 'plain text stays one block with its line breaks');
assert(splitTextBlocks(null).length === 0 && splitTextBlocks('').length === 0, 'empty text renders nothing');
assert(splitTextBlocks('| A | B |\r\n| :--- | ---: |\r\n| 1 | 2 |')[0].kind === 'table', 'Windows line breaks and aligned separators');
assert(splitTextBlocks('Fee: Rs. 500 | Rs. 250 for SC/ST')[0].kind === 'text', 'a pipe inside a sentence is not a table');

// Broken tables are refused by the proposal validator.
assert(tableProblems('| Post | Pay |\n| Goods Train Manager | 5 |').length === 2, 'every row without a separator line is flagged');
assert(tableProblems('| Post | Pay |\n|---|---|\n| Goods Train Manager | 5 | 2750 |').length === 1, 'a row with too many cells is flagged');
assert(tableProblems('| Post | Pay | Level |\n|---|---|\n| A | 1 | 2 |').length === 1, 'a separator with the wrong column count is flagged');
assert(tableProblems('|---|---|').length === 1, 'a lone separator line is flagged');
{
  const short = splitTextBlocks('| A | B | C |\n|---|---|---|\n| 1 | 2 |');
  assert(short[0].kind === 'table' && short[0].rows[0].length === 3 && short[0].rows[0][2] === '', 'a short row is padded so the grid stays square');
}
