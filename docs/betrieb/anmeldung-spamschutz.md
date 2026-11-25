# Spamschutz der öffentlichen Anmeldung (`/anmeldung`)

Das Formular unter `/anmeldung` ist ohne Login erreichbar und verschickt Bestätigungs-Mails von unserer Domain. Damit niemand es per Skript füllen kann (bis zu 300 Plätze, Spam-Mails an fremde Adressen), gibt es mehrere Schichten:

| Schicht | Wo | Was sie abfängt |
|---|---|---|
| Honeypot | App | einfache Bots, die jedes Feld ausfüllen |
| Signierter Start-Zeitpunkt | App (`src/lib/collectives/form-token.ts`) | Skripte, die schneller als 20 s absenden; die Uhr im Browser zählt nicht mehr |
| Cloudflare Turnstile | App (`src/lib/collectives/turnstile.ts`) | automatisierte Browser und Skripte ohne Mensch |
| Rate-Limit pro IP | Traefik (Coolify-Labels, unten) | viele Anmeldungen von einer Adresse in kurzer Zeit |
| Zeitfenster, Duplikat-Check, Obergrenze | App | alles, was trotzdem durchkommt |

## 1. Turnstile einrichten (einmalig, vor dem Merge)

**Wichtig:** Mit `APP_ENV=production` und ohne Turnstile-Schlüssel nimmt `/anmeldung` nichts mehr an, die Seite zeigt dann „technisch nicht erreichbar“. Deshalb zuerst die Schlüssel in Coolify eintragen und danach mergen.

1. Bei Cloudflare anmelden (kostenloses Konto reicht) → **Turnstile** → **Add widget**.
2. Name `Krachparade Orga`, Hostname `krachparade-orga.de`. Widget-Modus **Managed**. Speichern.
3. Coolify → App → **Environment Variables** (Production):
   - `TURNSTILE_SITE_KEY` = Site Key
   - `TURNSTILE_SECRET_KEY` = Secret Key
4. In den Vorschauen braucht es keine Schlüssel, Turnstile ist dort dann aus. Wer es in einer Vorschau testen will, nimmt die Testschlüssel von Cloudflare. Sie lassen immer durch:
   - `TURNSTILE_SITE_KEY=1x00000000000000000000AA`
   - `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`
5. Redeploy, dann `/anmeldung` öffnen: Über dem Knopf „Verbindlich anmelden“ erscheint das Cloudflare-Kästchen.

Den Start-Zeitpunkt signiert die App mit `AUTH_SECRET`. Dafür ist kein weiterer Schlüssel nötig. Wird `AUTH_SECRET` neu gesetzt, müssen offene Formulare einmal neu geladen werden. Die Eingaben bleiben dabei erhalten.

## 2. Rate-Limit in Traefik (Coolify)

Begrenzt **nur das Absenden** (POST auf `/anmeldung`) auf 5 Anfragen pro Minute und IP. Seitenaufrufe bleiben unbegrenzt. Wird die Grenze überschritten, antwortet Traefik mit `429`, und das Formular zeigt „Das hat nicht geklappt. Bitte noch einmal versuchen.“

1. Coolify → App (Production) → **Configuration** → **General** → Abschnitt **Container Labels**. Steht dort „Readonly labels“, das kurz ausschalten.
2. In den vorhandenen Labels den Namen des Traefik-Service suchen, zum Beispiel:
   ```
   traefik.http.services.https-0-3n9cq20oj7dfxlmncxqccvvc.loadbalancer.server.port=3000
   ```
   Der Teil zwischen `services.` und `.loadbalancer` (hier `https-0-3n9cq20oj7dfxlmncxqccvvc`) ist der Service-Name. Ebenso nachsehen, wie der Cert-Resolver heißt (meist `letsencrypt`) und wie der HTTPS-Entrypoint heißt (meist `https`).
3. Diese Zeilen **unten anhängen**. `<SERVICE>` durch den Service-Namen aus Schritt 2 ersetzen:
   ```
   traefik.http.middlewares.anmeldung-ratelimit.ratelimit.average=5
   traefik.http.middlewares.anmeldung-ratelimit.ratelimit.period=1m
   traefik.http.middlewares.anmeldung-ratelimit.ratelimit.burst=5
   traefik.http.routers.anmeldung-post.rule=Host(`krachparade-orga.de`) && Path(`/anmeldung`) && Method(`POST`)
   traefik.http.routers.anmeldung-post.entrypoints=https
   traefik.http.routers.anmeldung-post.priority=1000
   traefik.http.routers.anmeldung-post.tls=true
   traefik.http.routers.anmeldung-post.tls.certresolver=letsencrypt
   traefik.http.routers.anmeldung-post.middlewares=anmeldung-ratelimit
   traefik.http.routers.anmeldung-post.service=<SERVICE>
   ```
4. Speichern und **Redeploy**. Labels greifen erst mit einem neuen Container.
5. Prüfen (Git Bash). Die ersten 5 Antworten sind etwas anderes als `429`, danach kommt `429`:
   ```bash
   for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://krachparade-orga.de/anmeldung; done
   ```
   Kommt nie `429`, passt die Router-Zeile nicht. Dann in Coolify die Proxy-Logs ansehen (Servers → Proxy → Logs).

Hinweise:
- Coolify kann beim Ändern von Domain oder Ports die Labels neu erzeugen. Danach prüfen, ob die Zeilen oben noch da sind.
- Traefik sieht die echte IP der Besucher:innen direkt, weil kein CDN davor ist. Kommt später ein CDN oder ein Proxy davor, muss das Rate-Limit auf dessen Header umgestellt werden (`ratelimit.sourcecriterion.ipstrategy`).
- Die Vorschauen bekommen kein Rate-Limit.
