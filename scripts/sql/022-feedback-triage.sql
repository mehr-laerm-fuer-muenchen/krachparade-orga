-- Spec 022: Feedback-Triage – Sicht und Lese-Rolle
--
-- Wird NICHT automatisch ausgeführt. Franz führt diese Datei im Neon-SQL-Editor
-- aus, je einmal auf dem Zweig `dev` und auf `production`, jeweils mit einem
-- eigenen Passwort (Bitwarden). Danach den Eintrag mit dem Passwort aus dem
-- Verlauf des SQL-Editors löschen.
--
-- `db:push` kennt die Sicht nur (pgView(...).existing() in src/db/schema.ts),
-- legt sie also weder an noch löscht sie.

-- Sicht nur mit den Feldern, die die Triage braucht (keine Personen-Bezüge:
-- kein created_by, kein updated_by)
CREATE OR REPLACE VIEW feedback_triage AS
  SELECT id, kind, message, page_path, page_title, context, device, viewport,
         status, reply, created_at, updated_at
  FROM feedback;

-- Rolle ohne neon_superuser (per SQL angelegt), nur Lesen der Sicht
-- PASSWORT_HIER wird von Franz direkt im Neon-Editor ersetzt, nie ins Repo
CREATE ROLE triage_reader WITH LOGIN PASSWORD 'PASSWORT_HIER';
GRANT CONNECT ON DATABASE neondb TO triage_reader;
GRANT USAGE ON SCHEMA public TO triage_reader;
GRANT SELECT ON feedback_triage TO triage_reader;

-- Bewusst NICHT: GRANT ... ON ALL TABLES, ALTER DEFAULT PRIVILEGES.
-- Die Sicht läuft mit den Rechten ihrer Besitzer-Rolle; triage_reader braucht
-- deshalb kein Recht auf die Tabelle feedback selbst.

-- ---------------------------------------------------------------------------
-- Prüfblock (von Hand, als triage_reader verbunden, z. B. im Neon-SQL-Editor
-- mit Rolle triage_reader oder über die Lese-Adresse):
--
--   SELECT count(*) FROM feedback_triage;
--     → erwartet: eine Zahl (geht)
--
--   SELECT * FROM feedback;
--     → erwartet: ERROR: permission denied for table feedback
--
--   SELECT * FROM members;
--     → erwartet: ERROR: permission denied for table members
-- ---------------------------------------------------------------------------
