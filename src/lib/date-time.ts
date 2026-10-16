const berlinDateTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A moment in Europe/Berlin, e.g. "16. Oktober 2026, 14:05" (spec 014). */
export function formatGermanDateTime(moment: Date): string {
  const parts = Object.fromEntries(
    berlinDateTime.formatToParts(moment).map((part) => [part.type, part.value])
  );
  return `${parts.day}. ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}
