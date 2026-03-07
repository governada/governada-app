export function aggregateSentiment(rows: { sentiment: string }[]): {
  support: number;
  oppose: number;
  unsure: number;
  total: number;
} {
  const counts = { support: 0, oppose: 0, unsure: 0, total: rows.length };
  for (const row of rows) {
    if (row.sentiment === 'support') counts.support++;
    else if (row.sentiment === 'oppose') counts.oppose++;
    else if (row.sentiment === 'unsure') counts.unsure++;
  }
  return counts;
}
