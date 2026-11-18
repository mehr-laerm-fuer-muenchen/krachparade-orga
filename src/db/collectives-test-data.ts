import { emptyShirtOrder, type RegistrationStatus } from "../lib/collectives/options";
import type { RegistrationInput } from "../lib/collectives/registration-schema";

// Spec 031: made-up registrations of collectives for the dev seed, never in
// production. Only @example.org addresses and obviously fake phone numbers.

type TestCollective = { status: RegistrationStatus; input: RegistrationInput };

const DEMANDS =
  "Mehr Freiräume für Subkultur in München, bezahlbare Proberäume und eine Stadt, in der laute Kultur Platz hat.";

function shirts(standardM: number, soliL: number) {
  const order = emptyShirtOrder();
  order.standard.M = standardM;
  order.soli.L = soliL;
  return order;
}

const BASE = {
  demands: DEMANDS,
  instagram: null,
  tiktok: null,
  filesLink: null,
  orderPreference: null,
  jointWith: null,
  vehicleFilesLink: null,
  sectionLeadFirstName: null,
  sectionLeadLastName: null,
  sectionLeadEmail: null,
  sectionLeadPhone: null,
  sectionLeadNote: null,
  stewardsConfirmed: true,
  privacyConfirmed: true,
} as const;

export const TEST_COLLECTIVES: TestCollective[] = [
  {
    status: "accepted",
    input: {
      ...BASE,
      contactFirstName: "Robin",
      contactLastName: "Beispiel",
      contactEmail: "robin.beispiel@example.org",
      contactPhone: "+49 000 0000001",
      collectiveName: "Testkollektiv Lautstark",
      displayName: "TESTKOLLEKTIV LAUTSTARK",
      instagram: "@testkollektiv.lautstark",
      participatedBefore: true,
      musicType: "dj",
      genres: ["Techno / Hardtech / Uptime", "Melodic / House"],
      homeBase: "munich",
      eventSize: "200-500",
      vehicle: "truck_small",
      tuev: true,
      awareness: "Zwei Awareness-Personen auf dem Wagen, erkennbar an pinken Westen.",
      soundCoupling: true,
      atmosphere: "Tanzbar, laut und solidarisch.",
      orderPreference: "Gerne hinter der Bollerwagen-Bande.",
      sectionLeadFirstName: "Jo",
      sectionLeadLastName: "Muster",
      sectionLeadEmail: "jo.muster@example.org",
      sectionLeadPhone: "+49 000 0000002",
      vehicleLeadFirstName: "Kai",
      vehicleLeadLastName: "Probe",
      vehicleLeadEmail: "kai.probe@example.org",
      vehicleLeadSize: "L",
      vehicleLeadPhone: "+49 000 0000003",
      shirts: shirts(3, 1),
    },
  },
  {
    status: "new",
    input: {
      ...BASE,
      contactFirstName: "Mo",
      contactLastName: "Rollwagen",
      contactEmail: "mo.rollwagen@example.org",
      contactPhone: "+49 000 0000004",
      collectiveName: "Bollerwagen-Bande",
      displayName: "Bollerwagen-Bande",
      participatedBefore: false,
      musicType: "live",
      genres: ["Instrumental / Trommeln"],
      homeBase: "munich_area",
      eventSize: "1-50",
      vehicle: "non_motorized",
      tuev: null,
      awareness: "Wir achten aufeinander und sprechen Leute direkt an.",
      soundCoupling: false,
      atmosphere: "Verspielt und politisch.",
      vehicleLeadFirstName: "Lu",
      vehicleLeadLastName: "Schieber",
      vehicleLeadEmail: "lu.schieber@example.org",
      vehicleLeadSize: "S",
      vehicleLeadPhone: "+49 000 0000005",
      shirts: shirts(0, 2),
    },
  },
  {
    status: "waitlist",
    input: {
      ...BASE,
      contactFirstName: "Sam",
      contactLastName: "Tiefton",
      contactEmail: "sam.tiefton@example.org",
      contactPhone: "+49 000 0000006",
      collectiveName: "Basskombinat Süd",
      displayName: "BASSKOMBINAT SÜD",
      participatedBefore: true,
      musicType: "both",
      genres: ["Drum & Bass / Jungle / Liquid"],
      homeBase: "bavaria",
      eventSize: "500-1000",
      vehicle: "truck_large",
      tuev: false,
      awareness: "Eigener Code of Conduct, liegt am Wagen aus.",
      soundCoupling: true,
      atmosphere: "Kämpferisch und laut.",
      jointWith: "Wir teilen den Wagen mit einer Trommelgruppe.",
      vehicleLeadFirstName: "Ari",
      vehicleLeadLastName: "Wummer",
      vehicleLeadEmail: "ari.wummer@example.org",
      vehicleLeadSize: "XXL",
      vehicleLeadPhone: "+49 000 0000007",
      shirts: shirts(0, 0),
    },
  },
];
