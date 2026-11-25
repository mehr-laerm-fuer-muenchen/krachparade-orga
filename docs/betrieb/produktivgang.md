# Produktivgang: krachparade-orga.de mit echten Daten

Ziel: `https://krachparade-orga.de` läuft mit den echten Daten der Kern-Orga (übernommen aus der bisherigen App von Franz), Anmeldung nur mit Google. Die PR-Vorschauen laufen weiter mit der Demo-Datenbank und dem Dev-Login.

Danach gilt:

| | Production (`krachparade-orga.de`) | Vorschau (`<PR>.preview.krachparade-orga.de`) |
|---|---|---|
| Datenbank | Neon-Projekt **Production** (echte Daten) | Neon-Projekt **Krachparade Orga** (Demo, ausgedachte Daten) |
| Login | nur Google | Dev-Login (`/dev/login`) |
| `APP_ENV` | `production` | `preview` |
| Mails | über Resend (SMTP, Port 2587) | aus |

Geheimnisse (Datenbank-Adressen, Schlüssel, Passwörter) trägt man nur direkt in Coolify bzw. `.env.local` ein, nie in Chat, Issue oder Commit.

## 0. Voraussetzungen

- [ ] PR #9 (`VERCEL_ENV` → `APP_ENV`) ist gemergt und deployt.
- [ ] Franz ist einverstanden, dass die Daten umziehen. Es sind echte Personendaten (Namen, E-Mail-Adressen, bei Kollektiv-Anmeldungen auch Handynummern).
- [ ] Ein Zeitpunkt für den Umzug ist abgesprochen. Ab dem Export wird die alte App nicht mehr benutzt, sonst laufen die Daten auseinander.
- [ ] Docker Desktop läuft lokal (für `pg_dump`/`pg_restore`, ohne Postgres zu installieren).
- [ ] Snapshot des Servers im netcup-SCP (Media → Snapshots).

## 1. Neon: eigenes Projekt für Production

Neon-Konsole → **New Project**:

- Name: `Krachparade Orga Production`
- Region: **AWS Europe (Frankfurt)**
- Postgres-Version: **18** (wie das Demo-Projekt)

Ein eigenes Projekt statt eines Zweigs im Demo-Projekt, damit Vorschauen und Demo-Daten nie an die echten Daten kommen.

Unter **Connect** zwei Adressen kopieren und sicher ablegen:

- **Pooled** (Host mit `-pooler`): für Coolify (`DATABASE_URL`)
- **Direct** (ohne `-pooler`): für Import und `db:push:prod` (`DATABASE_URL_PROD`)

## 2. Daten bei Franz exportieren

Franz führt im Ordner, in dem die Datei landen soll, in PowerShell aus. `<ALTE_DIRECT_URL>` ist die **direkte** Adresse seiner Production-Datenbank (ohne `-pooler`):

```powershell
docker run --rm -v "${PWD}:/dump" postgres:18 pg_dump "<ALTE_DIRECT_URL>" --format=custom --no-owner --no-acl --file=/dump/krachparade.dump
```

- `--no-owner --no-acl`: Rollen und Rechte des alten Projekts werden nicht mitgenommen, nur Tabellen und Daten.
- Die Datei `krachparade.dump` enthält Personendaten. Nur verschlüsselt weitergeben (z. B. 7-Zip mit Passwort, Passwort auf anderem Weg), nach dem Import auf beiden Seiten löschen.

## 3. Daten in die neue Datenbank einspielen

Im Ordner mit `krachparade.dump`, `<NEUE_DIRECT_URL>` aus Schritt 1:

```powershell
docker run --rm -v "${PWD}:/dump" postgres:18 pg_restore --no-owner --no-acl --dbname="<NEUE_DIRECT_URL>" /dump/krachparade.dump
```

Meldungen zu Rollen (`role ... does not exist`) sind wegen `--no-owner` harmlos. Andere Fehler: abbrechen und klären.

Kurz prüfen, ob die Daten da sind (Neon-Konsole → **Tables**): `members`, `editions`, `meetings`, `plan_elements` haben Einträge.

## 4. Schema auf den aktuellen Stand bringen

Die alte Datenbank kennt vielleicht noch nicht alle Spalten und Tabellen der neueren Specs. Erst sichern, dann ergänzen:

1. Neon-Konsole, Projekt **Production** → **Branches** → **Create branch** von `production`, Name `backup-vor-produktivgang`.
2. In `.env.local` die Zeile `DATABASE_URL_PROD=<NEUE_DIRECT_URL>` eintragen.
3. Im Projektordner auf `main`:

   ```powershell
   pnpm db:push:prod
   ```

   drizzle zeigt vorher, was es tun will. Erlaubt sind nur **neue** Tabellen, Spalten und Indizes. Steht dort etwas mit `drop`, `rename`, `truncate` oder `delete`: **abbrechen** und klären.

## 5. Google-Login einrichten

[Google Cloud Console](https://console.cloud.google.com):

1. Neues Projekt `Krachparade Orga`.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name `Krachparade Orga`, Support-Mail `mehr.laerm.fuer.muenchen@gmail.com`
   - App domain: Homepage `https://krachparade-orga.de`, Datenschutz `https://krachparade-orga.de/datenschutz`
   - Authorized domain: `krachparade-orga.de`
   - Scopes: nur `openid`, `email`, `profile`
   - Danach **Publish app** („In production“). Sonst können sich nur einzeln eingetragene Testnutzer anmelden. Für diese drei Scopes braucht Google keine Prüfung.
3. **Credentials → Create credentials → OAuth client ID**
   - Typ **Web application**, Name `krachparade-orga.de`
   - Authorized JavaScript origins: `https://krachparade-orga.de`
   - Authorized redirect URIs: `https://krachparade-orga.de/api/auth/callback/google`
   - Client-ID und Client-Secret direkt in Coolify eintragen (Schritt 7).

## 6. Mails über Resend

Die netcup-Firewall sperrt ausgehend die Mail-Ports 25, 465 und 587. Resend nimmt SMTP auch auf **Port 2587** an:

1. Resend → **API keys** → neuer Schlüssel `krachparade-orga-smtp`, **Sending access**, Domain `krachparade-orga.de`.
2. Werte für Coolify (Schritt 7):

   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=2587
   SMTP_USER=resend
   SMTP_PASSWORD=<Resend-API-Schlüssel>
   MAIL_FROM=Krachparade Orga <orga@krachparade-orga.de>
   ```

## 7. Coolify umstellen

App → **Environment Variables** → Abschnitt **Production** (Vorschau-Variablen bleiben, wie sie sind). Alle mit Buildtime und Runtime:

| Variable | Wert |
|---|---|
| `DATABASE_URL` | **Pooled**-Adresse aus Schritt 1 |
| `AUTH_SECRET` | neu erzeugen: `npx auth secret --raw` |
| `AUTH_TRUST_HOST` | `true` |
| `APP_ENV` | `production` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | aus Schritt 5 |
| `ADMIN_EMAILS` | Google-Adressen der Admins, mit Komma getrennt |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | aus Schritt 6 |

**Löschen** bei Production: `ENABLE_DEV_LOGIN`, `VERCEL_ENV`.

Dann **Redeploy**.

## 8. Prüfen

- [ ] `https://krachparade-orga.de/login` zeigt „Mit Google anmelden“.
- [ ] `https://krachparade-orga.de/dev/login` antwortet mit **404**.
- [ ] Anmeldung mit einem Admin-Konto klappt, die echten Daten sind da.
- [ ] Ein normales Mitglied kann sich anmelden; eine fremde Google-Adresse wird abgewiesen.
- [ ] Eine PR-Vorschau zeigt weiter die Demo-Daten und den Dev-Login.
- [ ] Coolify zeigt „Running (healthy)“.

Danach die alte App von Franz stilllegen oder deutlich als „nicht mehr benutzen“ kennzeichnen und allen den neuen Link schicken.

## Rückweg, falls etwas schiefgeht

- **App startet nicht oder Login geht nicht:** In Coolify die Production-Variablen auf die Demo-Werte zurückstellen (Demo-`DATABASE_URL`, `APP_ENV=preview`, `ENABLE_DEV_LOGIN=1`) und neu deployen. Die echten Daten bleiben unberührt in Neon.
- **Schema-Schritt ging schief:** In Neon den Zweig `production` aus `backup-vor-produktivgang` wiederherstellen (**Branches → Restore**).
- **Server kaputt:** Snapshot aus Schritt 0 im netcup-SCP zurückspielen.

## Danach im Betrieb

- **Schema-Änderungen:** laufen automatisch. „Schema Vorschau“ gleicht beim PR die Demo-Datenbank ab, „Schema Production“ nach dem Merge Production (vorher Backup-Zweig `backup-vor-push-…` in Neon). Nur hinzufügend; bei allem anderen bricht die Action ab und es wird von Hand geklärt. Alte Backup-Zweige ab und zu in Neon löschen (Free-Plan: begrenzte Zahl an Zweigen).
- **Einrichtung der Actions (einmalig):** GitHub → Settings → Secrets and variables → Actions: Secret `PREVIEW_DATABASE_URL` nur, wenn die Vorschauen eine andere Datenbank nutzen als die Klicktests (`DEV_DATABASE_URL`); sonst nimmt die Action `DEV_DATABASE_URL`. Settings → Environments → **New environment** `production`, bei *Deployment branches* nur `main` erlauben; darin Secret `PROD_DATABASE_URL` (Direct-Adresse aus Schritt 1), Secret `NEON_API_KEY` (Neon → Account → API keys) und Variable `NEON_PROD_PROJECT_ID` (Neon → Projekt Production → Settings).
- **Vorschauen** benutzen nie die Production-Datenbank. Die Vorschau-Variablen in Coolify zeigen immer auf das Demo-Projekt.
- **GitHub-Klicktests** nutzen das Secret `DEV_DATABASE_URL`. Es darf nie auf Production zeigen.
- **Sicherung:** Neon kann einen Zweig auf einen früheren Zeitpunkt zurücksetzen (Zeitraum je nach Plan). Vor größeren Änderungen zusätzlich einen Backup-Zweig anlegen.
