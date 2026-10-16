/** "Keine neuen Meldungen." / "1 neue Meldung" / "2 neue Meldungen". */
export function newFeedbackText(count: number): string {
  if (count <= 0) return "Keine neuen Meldungen.";
  if (count === 1) return "1 neue Meldung";
  return `${count} neue Meldungen`;
}
