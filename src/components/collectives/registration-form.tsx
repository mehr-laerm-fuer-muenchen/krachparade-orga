"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { submitRegistration } from "@/actions/collective-registration";
import { DEPOSIT_EUR, SHIRT_PRICE_EUR, TUEV_EUR, formatEuro, registrationCosts } from "@/lib/collectives/costs";
import {
  emptyFormValues,
  firstErrorField,
  formErrors,
  parseDraft,
  shirtNumbersForCosts,
  toRegistrationInput,
  type FormValues,
  type TextFieldName,
} from "@/lib/collectives/form-values";
import {
  EVENT_SIZES,
  EVENT_SIZE_LABELS,
  GENRES,
  HOME_BASES,
  HOME_BASE_LABELS,
  MAX_GENRES,
  MUSIC_TYPES,
  MUSIC_TYPE_LABELS,
  ORGA_EMAIL,
  SHIRT_KINDS,
  SHIRT_KIND_LABELS,
  SHIRT_SIZES,
  STEWARD_RULES_URL,
  VEHICLES,
  VEHICLE_LABELS,
  VEST_SIZES,
  isMotorized,
} from "@/lib/collectives/options";
import { DEMANDS_MIN, NAME_MAX, SHORT_MAX, TEXT_MAX } from "@/lib/collectives/registration-schema";
import { Choice, Confirm, MultiChoice, NumberField, Section, TextArea, TextField, YesNo, fieldId } from "./registration-fields";

const DRAFT_KEY = "kp-anmeldung-entwurf";
const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";
const ERROR_INPUT = "Bitte prüft die markierten Felder.";

// Storage can be missing or blocked, so every access is wrapped.
function readDraft(): FormValues | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? parseDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeDraft(values: FormValues) {
  try {
    // Confirmations are never restored (parseDraft), so they are not stored either.
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...values, stewardsConfirmed: false, privacyConfirmed: false })
    );
  } catch {
    // Not remembered on this device.
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

function focusField(name: string) {
  const element = document.getElementById(fieldId(name));
  if (!element) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  const target =
    element instanceof HTMLFieldSetElement ? (element.querySelector("input") ?? element) : element;
  target.focus({ preventScroll: true });
}

/**
 * The public registration form of the collectives (spec 031). One page with
 * the sections of the former Google form; checked in the browser and again
 * on the server.
 */
export function RegistrationForm({ retentionEndLabel }: { retentionEndLabel: string }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(emptyFormValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [pending, startTransition] = useTransition();
  const startedAt = useRef(0);
  const restored = useRef(false);

  // The first render is empty (same as on the server); a draft of this device
  // applies right after.
  useEffect(() => {
    startedAt.current = Date.now();
    const draft = readDraft();
    restored.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage after hydration
    if (draft) setValues(draft);
  }, []);

  useEffect(() => {
    if (restored.current) writeDraft(values);
  }, [values]);

  const clearError = (name: string) => {
    setErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const set = <K extends keyof FormValues>(name: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [name]: value }));
    clearError(name);
    setMessage(null);
  };

  const text = (name: TextFieldName) => ({
    name,
    value: values[name],
    onChange: (value: string) => set(name, value),
    error: errors[name],
  });

  const motorized = values.vehicle !== "" && isMotorized(values.vehicle);
  const costs = registrationCosts({
    tuev: motorized && values.tuev === "yes",
    shirts: shirtNumbersForCosts(values),
  });

  const showErrors = (next: Record<string, string>) => {
    setErrors(next);
    const first = firstErrorField(next);
    if (first) requestAnimationFrame(() => focusField(first));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const local = formErrors(values);
    if (Object.keys(local).length > 0) {
      setMessage(ERROR_INPUT);
      showErrors(local);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await submitRegistration(toRegistrationInput(values), {
          website,
          startedAt: startedAt.current,
        });
        if (result.ok) {
          clearDraft();
          restored.current = false;
          router.push(`/anmeldung/danke?id=${encodeURIComponent(result.id)}`);
          return;
        }
        setMessage(result.message ?? GENERIC_ERROR);
        if (result.fieldErrors) showErrors(result.fieldErrors);
      } catch {
        setMessage(GENERIC_ERROR);
      }
    });
  };

  const demandsLeft = Math.max(0, DEMANDS_MIN - values.demands.trim().length);

  return (
    <form onSubmit={submit} noValidate aria-label="Anmeldung" className="flex flex-col gap-6">
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <p className="text-sm text-muted">
        Felder mit <span className="text-status-late">*</span> sind Pflicht. Deine Eingaben bleiben auf diesem
        Gerät, bis du absendest.
      </p>

      <Section id="kontakt" title="Hauptansprechpartner/in">
        <p className="text-muted">
          Die Person, die für euer Kollektiv alle Kommunikation rund um die Krachparade übernimmt. Sie kann, muss
          aber nicht die oder der Wagenverantwortliche sein.
        </p>
        <div className="grid gap-5 desk:grid-cols-2">
          <TextField {...text("contactFirstName")} label="Vorname" required autoComplete="given-name" maxLength={NAME_MAX} />
          <TextField {...text("contactLastName")} label="Nachname" required autoComplete="family-name" maxLength={NAME_MAX} />
          <TextField {...text("contactEmail")} label="E-Mail" type="email" required autoComplete="email" />
          <TextField {...text("contactPhone")} label="Telefonnummer (mobil)" type="tel" required autoComplete="tel" />
        </div>
      </Section>

      <Section id="kollektiv" title="Kollektiv / Initiative / Bündnis">
        <TextField {...text("collectiveName")} label="Name" required maxLength={SHORT_MAX} />
        <TextField
          {...text("displayName")}
          label="Schreibweise"
          hint="So schreiben wir euren Namen auf T-Shirts, Plakate usw."
          required
          maxLength={SHORT_MAX}
        />
        <TextArea
          {...text("demands")}
          label="Politische / kulturelle Forderungen"
          hint="Welche politischen und/oder kulturellen Forderungen setzt ihr bei der Krachparade? Beschreibt kurz eure Inhalte, Themen oder Anliegen."
          required
          maxLength={TEXT_MAX}
          footer={
            <p className="text-sm text-muted" aria-live="polite">
              {demandsLeft > 0 ? `Noch mindestens ${demandsLeft} Zeichen` : "Lang genug"}
            </p>
          }
        />
        <div className="grid gap-5 desk:grid-cols-2">
          <TextField {...text("instagram")} label="Instagram" placeholder="@euer.kollektiv" maxLength={SHORT_MAX} />
          <TextField {...text("tiktok")} label="TikTok" placeholder="@euer.kollektiv" maxLength={SHORT_MAX} />
        </div>
        <TextField
          {...text("filesLink")}
          type="url"
          label="Link zu Dateien (Reden, Logos, Bilder)"
          hint={`Drive, Dropbox o. Ä. – oder schickt die Dateien per Mail an ${ORGA_EMAIL}.`}
          placeholder="https://"
        />
        <YesNo
          name="participatedBefore"
          label="Wart ihr schon mal bei der Krachparade dabei?"
          value={values.participatedBefore}
          onChange={(value) => set("participatedBefore", value)}
          error={errors.participatedBefore}
        />
        <Choice
          name="musicType"
          label="Spielt ihr Live-Musik oder über DJs?"
          options={MUSIC_TYPES.map((value) => ({ value, label: MUSIC_TYPE_LABELS[value] }))}
          value={values.musicType}
          onChange={(value) => {
            set("musicType", value);
            clearError("genres");
          }}
          error={errors.musicType}
          required
        />
        <MultiChoice
          name="genres"
          label={`Welchem Genre ist eure Musik am ehesten zuzuordnen? (bis zu ${MAX_GENRES})`}
          options={GENRES}
          values={values.genres}
          onChange={(genres) => set("genres", genres)}
          max={MAX_GENRES}
          error={errors.genres}
          hint={values.musicType === "none" ? "Ohne Musik könnt ihr das leer lassen." : undefined}
          required={values.musicType !== "none"}
        />
        <Choice
          name="homeBase"
          label="Wo ist eure Homebase?"
          options={HOME_BASES.map((value) => ({ value, label: HOME_BASE_LABELS[value] }))}
          value={values.homeBase}
          onChange={(value) => set("homeBase", value)}
          error={errors.homeBase}
          required
        />
        <Choice
          name="eventSize"
          label="Wie viele Leute kommen regelmäßig zu euren Events?"
          options={EVENT_SIZES.map((value) => ({ value, label: EVENT_SIZE_LABELS[value] }))}
          value={values.eventSize}
          onChange={(value) => set("eventSize", value)}
          error={errors.eventSize}
          required
        />
      </Section>

      <Section id="wagen" title="Wagen">
        <Choice
          name="vehicle"
          label="Wir nehmen teil mit:"
          options={VEHICLES.map((value) => ({ value, label: VEHICLE_LABELS[value] }))}
          value={values.vehicle}
          onChange={(value) => {
            set("vehicle", value);
            clearError("tuev");
          }}
          error={errors.vehicle}
          required
        />
        {motorized ? (
          <YesNo
            name="tuev"
            label="Sollen wir euren Wagen zum TÜV anmelden, damit Menschen darauf mitfahren (z. B. tanzen) können?"
            hint={
              <>
                Kosten: {TUEV_EUR} €* pro Kollektiv. Ohne TÜV fahren nur die absolut notwendigen Personen mit (DJ,
                Wagenverantwortliche/r, Technik). *Was am Ende zu viel gezahlt ist, verbuchen wir als freiwillige
                Spende an die Initiative Mehr Lärm für München. Wollt ihr das nicht, schreibt uns an {ORGA_EMAIL},
                dann überweisen wir es zurück.
              </>
            }
            value={values.tuev}
            onChange={(value) => set("tuev", value)}
            error={errors.tuev}
          />
        ) : null}
        <TextArea
          {...text("awareness")}
          label="Awareness / Code of Conduct"
          hint="Wie geht ihr auf eurem Wagen oder in eurem Beitrag mit Awareness, gegenseitigem Respekt und einem diskriminierungsfreien Miteinander um? Habt ihr einen eigenen Code of Conduct, könnt ihr ihn hier angeben."
          required
          maxLength={TEXT_MAX}
        />
        <YesNo
          name="soundCoupling"
          label="Möchtet ihr mit eurem Wagen an der Soundkopplung teilnehmen?"
          hint="Zur Abschlusskundgebung schließen wir mehrere Wagen zu einer großen „Wall of Sound“ zusammen, um das zentrale Programm zu verstärken."
          value={values.soundCoupling}
          onChange={(value) => set("soundCoupling", value)}
          error={errors.soundCoupling}
        />
        <TextArea
          {...text("atmosphere")}
          label="Welche Atmosphäre wollt ihr auf dem Wagen?"
          hint="Zum Beispiel ruhig, kämpferisch, verspielt, solidarisch, laut, tanzbar, politisch, experimentell. Das hilft uns, die Krachparade stimmig zu planen."
          required
          maxLength={TEXT_MAX}
        />
        <TextArea
          {...text("orderPreference")}
          label="Wunsch bei der Wagenreihenfolge"
          hint="Möchtet ihr z. B. vor oder hinter einem bestimmten Kollektiv fahren? Wir versuchen, Wünsche zu berücksichtigen, können es aber nicht garantieren."
          maxLength={TEXT_MAX}
        />
        <TextArea
          {...text("jointWith")}
          label="Wir schließen uns mit folgendem Kollektiv / Band / Initiative zusammen"
          hint="Gestaltet ihr einen Wagen oder Programmpunkt gemeinsam mit anderen? Nennt bitte die Namen."
          maxLength={TEXT_MAX}
        />
        <TextField
          {...text("vehicleFilesLink")}
          type="url"
          label="Link zu Bildern oder Angaben zu eurem Wagen"
          hint={`Oder per Mail an ${ORGA_EMAIL}.`}
          placeholder="https://"
        />
      </Section>

      {motorized ? (
        <Section id="abschnittsleitung" title="Freiwillige Abschnittsleitung">
          <p className="text-muted">
            Eine Person, die am Tag der Demo bis zu drei Wagen betreut und mit der Demoleitung und den
            Wagenverantwortlichen kommuniziert. Sie wird nicht am eigenen Wagen eingesetzt. Freiwillig – alle Felder
            können leer bleiben.
          </p>
          <div className="grid gap-5 desk:grid-cols-2">
            <TextField {...text("sectionLeadFirstName")} label="Vorname" maxLength={NAME_MAX} />
            <TextField {...text("sectionLeadLastName")} label="Nachname" maxLength={NAME_MAX} />
            <TextField {...text("sectionLeadEmail")} label="E-Mail" type="email" />
            <TextField {...text("sectionLeadPhone")} label="Telefonnummer (mobil)" type="tel" />
          </div>
          <TextArea
            {...text("sectionLeadNote")}
            label="Anmerkung"
            hint="Erfahrungen, Stärken, Einschränkungen, Zeiten oder Wünsche zur Einteilung."
            maxLength={TEXT_MAX}
          />
        </Section>
      ) : null}

      <Section id="wagenverantwortliche" title="Wagenverantwortliche/r">
        <p className="text-muted">
          Am Tag der Parade unsere Ansprechperson am Wagen: in unmittelbarer Nähe oder auf dem Wagen, spricht mit
          Fahrer/in, DJs und Technik.
        </p>
        <div className="grid gap-5 desk:grid-cols-2">
          <TextField {...text("vehicleLeadFirstName")} label="Vorname" required maxLength={NAME_MAX} />
          <TextField {...text("vehicleLeadLastName")} label="Nachname" required maxLength={NAME_MAX} />
          <TextField {...text("vehicleLeadEmail")} label="E-Mail" type="email" required />
          <TextField {...text("vehicleLeadPhone")} label="Telefonnummer (mobil)" type="tel" required />
        </div>
        <Choice
          name="vehicleLeadSize"
          label="Größe für die Warnweste"
          options={VEST_SIZES.map((value) => ({ value, label: value }))}
          value={values.vehicleLeadSize}
          onChange={(value) => set("vehicleLeadSize", value)}
          error={errors.vehicleLeadSize}
          required
        />
      </Section>

      <Section id="shirts" title="T-Shirts">
        <p className="text-muted">
          Erinnerungs-T-Shirts mit unserem Design, bestellt zentral über uns. Grundpreis {SHIRT_PRICE_EUR.standard} €*,
          Soli-Preis {SHIRT_PRICE_EUR.soli} €* (mit dem Aufpreis unterstützt ihr die Initiative Mehr Lärm für München).
          *Was über den Selbstkostenpreis hinausgeht, verbuchen wir als Spende an die Initiative. Keine Shirts? Dann
          lasst überall 0 stehen.
        </p>
        {SHIRT_KINDS.map((kind) => (
          <fieldset key={kind} className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">
              {SHIRT_KIND_LABELS[kind]} ({SHIRT_PRICE_EUR[kind]} € pro Shirt)
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-3">
              {SHIRT_SIZES.map((size) => {
                const name = `shirts.${kind}.${size}`;
                return (
                  <NumberField
                    key={size}
                    name={name}
                    label={size}
                    value={values.shirts[kind][size]}
                    onChange={(value) => {
                      setValues((current) => ({
                        ...current,
                        shirts: { ...current.shirts, [kind]: { ...current.shirts[kind], [size]: value } },
                      }));
                      clearError(name);
                      setMessage(null);
                    }}
                    error={errors[name]}
                  />
                );
              })}
            </div>
          </fieldset>
        ))}
      </Section>

      <Section id="ordner" title="Ordner">
        <p>
          Um an der Parade teilzunehmen, stellt jedes Kollektiv je nach Größe des Wagens genug Wagenordner und
          Demoordner. Wagenordner sichern den fahrenden Wagen, z. B. mit einem Seil. Demoordner achten auf die
          Auflagen, sperren z. B. Fahrstreifen ab und achten darauf, dass alle in den zugewiesenen Flächen bleiben.
          Die Auflagen findet ihr unter{" "}
          <a href={STEWARD_RULES_URL} target="_blank" rel="noreferrer" className="break-all text-primary underline">
            {STEWARD_RULES_URL}
          </a>
          . Ungeeignete oder zu wenige Ordner führen am Tag der Parade zum Ausschluss.
        </p>
        <Confirm
          name="stewardsConfirmed"
          checked={values.stewardsConfirmed}
          onChange={(checked) => set("stewardsConfirmed", checked)}
          error={errors.stewardsConfirmed}
        >
          Ich habe die Auflagen für die Ordner gelesen und verstanden. Mir ist bewusst, dass fehlende Ordner zu einem
          Ausschluss am Tag der Parade führen.
        </Confirm>
        {errors.stewardsConfirmed ? (
          <p className="rounded-md border border-hint-border bg-hint-bg px-4 py-3">
            Ohne Ordner geht es nicht. Meldet euch bei uns per Mail oder Telegram, wenn ihr das nicht schafft oder
            Fragen habt – unsere Kontakte stehen auf www.krachparade.de.
          </p>
        ) : null}
      </Section>

      <Section id="datenschutz" title="Datenschutz">
        <Confirm
          name="privacyConfirmed"
          checked={values.privacyConfirmed}
          onChange={(checked) => set("privacyConfirmed", checked)}
          error={errors.privacyConfirmed}
        >
          Wir sind einverstanden, dass die Orga der Krachparade diese Angaben zur Planung der Krachparade 2027
          speichert. Alle Angaben, auch die Telefonnummern, löschen wir drei Monate nach der Krachparade (am{" "}
          {retentionEndLabel}). Eine Bestätigung schicken wir per E-Mail.
        </Confirm>
        <p className="text-sm">
          Mehr dazu in unserer{" "}
          <a href="/datenschutz" target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-2">
            Datenschutzerklärung
          </a>
          .
        </p>
      </Section>

      <Section id="kosten" title="Kosten">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>Pfand für das Wagenpaket</dt>
          <dd className="text-right tabular-nums">{formatEuro(DEPOSIT_EUR)}</dd>
          <dt>TÜV</dt>
          <dd className="text-right tabular-nums">{formatEuro(costs.tuev)}</dd>
          <dt>T-Shirts Standard</dt>
          <dd className="text-right tabular-nums">{formatEuro(costs.shirtsStandard)}</dd>
          <dt>T-Shirts Soli</dt>
          <dd className="text-right tabular-nums">{formatEuro(costs.shirtsSoli)}</dd>
          <dt className="border-t border-line pt-1 font-semibold">Summe</dt>
          <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums" data-testid="kosten-summe">
            {formatEuro(costs.total)}
          </dd>
        </dl>
        <p className="text-sm text-muted">
          Überweist erst, nachdem wir eure Anmeldung bestätigt haben. Das Pfand bekommt ihr zurück, sobald das
          Wagenpaket wieder bei uns ist.
        </p>
      </Section>

      <div className="flex flex-col gap-3">
        {message ? (
          <p role="alert" className="font-medium text-status-late">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90 disabled:opacity-50 desk:w-fit"
        >
          {pending ? "Wird gesendet …" : "Verbindlich anmelden"}
        </button>
      </div>
    </form>
  );
}
