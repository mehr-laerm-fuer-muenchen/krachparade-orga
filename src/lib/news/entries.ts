// Release notes behind the bell in the header (spec 015). Every spec brings
// its entry; it goes live with the deploy. Newest first.

export type NewsItem = { lead: string; text?: string };

export type NewsEntry = {
  /** Unique, e.g. the spec name "015-neuigkeiten" or "r1-start". */
  id: string;
  /** "YYYY-MM-DD", calendar day in Europe/Berlin. */
  date: string;
  /** Short, at most 60 characters. */
  title: string;
  /** 1–5 points. */
  items: NewsItem[];
};

export const NEWS: NewsEntry[] = [
  {
    id: "017-protokoll-lesen",
    date: "2026-10-16",
    title: "Protokolle lesen und bearbeiten",
    items: [
      {
        lead: "Leseansicht.",
        text: "Fertige Protokolle zeigen oben die Kurzfassung, dann Beschlüsse und To-dos, darunter die Infos je TOP – ohne Eingabefelder.",
      },
      {
        lead: "Ein Knopf zum Wechseln.",
        text: "Mit „Bearbeiten“ und „Leseansicht“ wechselst du jederzeit. Entwürfe öffnen zum Bearbeiten, finale Protokolle zum Lesen.",
      },
      {
        lead: "Kurzfassung.",
        text: "Ein paar Sätze zum Treffen, die oben in der Leseansicht und im Telegram-Text stehen.",
      },
    ],
  },
  {
    id: "016-checklisten-fortschritt",
    date: "2026-10-16",
    title: "Abhaken und Fortschritt im Plan",
    items: [
      {
        lead: "Fortschritt auf einen Blick.",
        text: "Hat ein Element To-dos, zeigen Gantt und Wochenliste, wie viele davon erledigt sind, zum Beispiel „3/10“.",
      },
      {
        lead: "Abhaken in der Wochenliste.",
        text: "Das Kästchen vor einem Element markiert es als erreicht. Über „3/10“ klappst du die To-dos auf und hakst sie einzeln ab.",
      },
      {
        lead: "Alles erledigt?",
        text: "Ist das letzte To-do abgehakt, fragt die App, ob das Element erreicht ist.",
      },
      {
        lead: "„Gespeichert ✓“.",
        text: "Neben jedem Feld siehst du kurz, dass deine Eingabe gespeichert ist.",
      },
      {
        lead: "Beschluss statt Entscheidung.",
        text: "Im Protokoll heißt es jetzt überall „Beschluss“.",
      },
    ],
  },
  {
    id: "015-neuigkeiten",
    date: "2026-10-16",
    title: "Neuigkeiten in der App",
    items: [
      {
        lead: "Glocke in der Kopfleiste.",
        text: "Hier steht ab jetzt nach jedem Update, was neu ist. Ein pinker Punkt zeigt, dass es seit deinem letzten Blick etwas Neues gibt.",
      },
      {
        lead: "Am Handy nur noch das Logo.",
        text: "Damit Glocke, Käfer und Countdown in eine Zeile passen, entfällt am Handy der Schriftzug.",
      },
    ],
  },
  {
    id: "013-begriff-krachparade",
    date: "2026-10-16",
    title: "Alles zählt auf die Krachparade",
    items: [
      {
        lead: "Neuer Begriff.",
        text: "Der große Tag heißt in der App jetzt überall „Krachparade“, auch die Linie im Gantt.",
      },
      {
        lead: "Countdown in Tagen.",
        text: "Oben steht, wie viele Tage es noch sind, zum Beispiel „noch 204 T“. Termine im Plan zeigen den Abstand als „80 T vorher“.",
      },
    ],
  },
  {
    id: "014-feedback",
    date: "2026-10-16",
    title: "Feedback direkt in der App",
    items: [
      {
        lead: "Käfer in der Kopfleiste.",
        text: "Fehler oder Wunsch melden, ohne die Seite zu verlassen. Seite, Gerät und das gerade offene Plan-Element hängen automatisch dran.",
      },
      {
        lead: "Alle Meldungen einsehbar.",
        text: "Unter Einstellungen → Feedback (am Handy unter „Mehr“) siehst du alle Meldungen mit Status und Antwort.",
      },
    ],
  },
  {
    id: "r1-start",
    date: "2026-10-15",
    title: "Start der Orga-App",
    items: [
      {
        lead: "Plan bis zur Krachparade.",
        text: "Alle Meilensteine und Vorgänge als Gantt oder Liste am Laptop und als Liste nach Wochen am Handy, rückwärts von der Krachparade gerechnet. Verschiebt sich etwas, rechnet die App alle abhängigen Termine neu und zeigt Puffer und Verzug.",
      },
      {
        lead: "Bearbeiten direkt im Plan.",
        text: "Balken ziehen oder an den Rändern verlängern, am Handy über −7/−1/+1/+7 T. Jedes Element hat To-dos, Notizen und einen Verlauf.",
      },
      {
        lead: "AKs.",
        text: "Die vorgeschlagenen Arbeitskreise mit ihren Aufgabenbereichen. Über „Mach ich mit“ trägst du dich selbst ein. Die AKs sind noch ein Vorschlag, bis sie gemeinsam beschlossen sind.",
      },
      {
        lead: "Protokolle.",
        text: "Treffen mit TOPs, Beschlüssen und To-dos mitschreiben oder Notizen und Transkripte einfügen.",
      },
      {
        lead: "Meine Aufgaben.",
        text: "Alles, was bei dir liegt, als Zeitliste: eigene Plan-Elemente und To-dos aus Plan und Protokollen. Abhaken direkt in der Liste, die pinke Zahl zeigt Überfälliges.",
      },
    ],
  },
];
