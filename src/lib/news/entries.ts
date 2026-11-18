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
    id: "034-dunkles-design",
    date: "2026-11-18",
    title: "Hell oder dunkel – du entscheidest",
    items: [
      {
        lead: "Neuer Schalter unter Einstellungen → Darstellung",
        text: "Mit Sonne und Mond wechselst du zwischen hellem und dunklem Design.",
      },
      {
        lead: "Gilt pro Gerät",
        text: "Die Wahl bleibt auf diesem Handy oder Laptop gespeichert. Mit „Wie das Gerät“ folgt die App wieder deiner Systemeinstellung.",
      },
    ],
  },
  {
    id: "030-krachparade-tag",
    date: "2026-11-07",
    title: "Der Tag der Krachparade",
    items: [
      {
        lead: "Neue Seite „Krachparade“",
        text: "Ablauf des Tages mit Spalten für Programm, Demozug und Orga. Am Laptop verschiebst du Blöcke per Drag & Drop, am Handy mit ±15 min.",
      },
      {
        lead: "Checklisten am Ablauf",
        text: "Jeder Eintrag hat eine Checkliste zum Abhaken, z. B. „Schild „Ab hier Sound AUS“ gestellt“.",
      },
      {
        lead: "Rollen am Tag",
        text: "Wer macht Versammlungsleitung, Demozentrale & Co.? Unbesetzte Rollen siehst du sofort.",
      },
      { lead: "Startet mit dem Ablauf von 2026", text: "Passt ihn gemeinsam an." },
    ],
  },
  {
    id: "029-top-loeschen",
    date: "2026-11-07",
    title: "TOPs löschen",
    items: [
      {
        lead: "Papierkorb am TOP",
        text: "Im Bearbeiten-Modus löschst du einen TOP jetzt samt seinen Punkten. Vorher fragt die App nach und sagt dir, wie viele Beschlüsse und To-dos dabei mit verschwinden.",
      },
    ],
  },
  {
    id: "028-punkt-mehrzeilig",
    date: "2026-11-07",
    title: "Längere Punkte im Protokoll",
    items: [
      {
        lead: "Mehrere Zeilen",
        text: "Punkte im Protokoll dürfen jetzt mehrere Zeilen haben. Am Laptop geht das mit Umschalt+Enter, am Handy mit Enter. Gespeichert wird am Handy mit „Speichern“.",
      },
      {
        lead: "Bleibt erhalten",
        text: "Die Zeilen siehst du auch in der Leseansicht, in deinen Aufgaben und beim Kopieren als Text oder Markdown.",
      },
    ],
  },
  {
    id: "026-gantt-zeitfenster",
    date: "2026-10-17",
    title: "Zeitfenster im Gantt",
    items: [
      {
        lead: "Helles Band",
        text: "Hinter jedem Balken zeigt ein helles Band das Zeitfenster von frühestens bis spätestens. Über „Fenster“ blendest du die Bänder aus und ein.",
      },
      {
        lead: "Luft und Pin",
        text: "Im Label steht jetzt die Luft, feste Termine haben einen Pin.",
      },
      {
        lead: "Kritisch und knapp",
        text: "Kritisch (keine Luft) hat einen pinken Rahmen, knapp (höchstens 7 Tage) einen gestrichelten – im Gantt und in der Wochenliste. Der Filter „Kritisch & knapp“ erklärt, was das heißt.",
      },
      {
        lead: "Ursache",
        text: "Ist etwas nur im Verzug, weil davor etwas klemmt, nennt das Element jetzt die Ursache – ein Tipp darauf führt direkt hin.",
      },
    ],
  },
  {
    id: "025-zeitfenster-rechnung",
    date: "2026-10-17",
    title: "Zeitfenster statt fester Abstände",
    items: [
      {
        lead: "Zeitfenster und Lage",
        text: "Jedes Plan-Element hat jetzt ein Zeitfenster von frühestens bis spätestens und eine Lage: fest, so früh wie möglich, so spät wie möglich oder frei im Fenster. Du findest beides im Element.",
      },
      {
        lead: "Abstände sind Mindestabstände",
        text: "(„mind. 7 T danach“). 0 heißt: nur die Reihenfolge zählt.",
      },
      {
        lead: "Luft",
        text: "zeigt, wie weit etwas noch rutschen kann. Der Filter heißt jetzt „Kritisch & knapp“: kritisch = keine Luft, knapp = höchstens 7 Tage.",
      },
      {
        lead: "Neuer Status „Zu früh“",
        text: "(gelb), wenn etwas vor seinem Vorgänger liegt. Erreichte Elemente bleiben an dem Tag, an dem sie abgehakt wurden.",
      },
      {
        lead: "Ziehen legt den Termin selbst fest",
        text: "(Lage „Frei im Fenster“). Deine bisherigen Termine sind gleich geblieben; die Fenster im Gantt kommen mit dem nächsten Update.",
      },
    ],
  },
  {
    id: "024-fortschritt-aks",
    date: "2026-10-17",
    title: "Fortschritt in den AKs",
    items: [
      {
        lead: "AK-Karten",
        text: "zeigen jetzt, wie viele To-dos schon erledigt sind – mit Fortschrittsleiste.",
      },
      {
        lead: "Aufgabenbereiche",
        text: "erkennst du am Pfeil als aufklappbar; im Kopf steht ihr Fortschritt.",
      },
      {
        lead: "Alles erledigt ✓",
        text: "erscheint, sobald in einem Bereich nichts mehr offen ist.",
      },
    ],
  },
  {
    id: "023-klarer-machen",
    date: "2026-10-17",
    title: "Fälligkeiten mit Datum, Fortschritt im Panel",
    items: [
      {
        lead: "Fälligkeiten von To-dos",
        text: "stehen jetzt mit Datum da, z. B. „fällig 18.12. (3 Tage vor Start)“.",
      },
      {
        lead: "Fortschritt",
        text: "siehst du auch oben im Panel, neben Status und Puffer.",
      },
      {
        lead: "Der Käfer",
        text: "heißt jetzt „Feedback zur App“ – Inhaltliches zur Krachparade gehört in die Notizen.",
      },
    ],
  },
  {
    id: "018-ak-arbeitsbereich",
    date: "2026-10-16",
    title: "Arbeitsbereich für jeden AK",
    items: [
      {
        lead: "AKs auf einen Blick.",
        text: "Die Seite „AKs“ zeigt für jeden AK, was in Verzug ist, was wackelt, wie viele To-dos offen sind und was als Nächstes ansteht.",
      },
      {
        lead: "Arbeitsbereich je AK.",
        text: "Tipp eine AK-Karte an: Oben steht, was Aufmerksamkeit braucht, darunter je Aufgabenbereich Plan, To-dos aus Treffen und Beschlüsse. Abhaken geht direkt dort.",
      },
      {
        lead: "Laufende Aufgaben.",
        text: "Punkte ohne Termin trägst du im Aufgabenbereich ein. Sie stehen nicht im Gantt, aber in „Meine“ unter „Ohne Datum“.",
      },
      {
        lead: "Notizen.",
        text: "Freie Notizen gibt es jetzt für den ganzen AK und für jeden Aufgabenbereich.",
      },
      {
        lead: "AKs verwalten.",
        text: "Wer in welchem AK ist und welche Bereiche dazugehören, pflegst du über „AKs verwalten“ oben auf der Seite.",
      },
    ],
  },
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
