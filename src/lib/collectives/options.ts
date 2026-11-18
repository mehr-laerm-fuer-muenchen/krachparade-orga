// Answer options of the registration form for collectives (spec 031), in the
// order of the former Google form. Stored values are English keys, labels
// are the German texts shown in the form, the list and the CSV.

export const MUSIC_TYPES = ["live", "dj", "both", "none"] as const;
export type MusicType = (typeof MUSIC_TYPES)[number];
export const MUSIC_TYPE_LABELS: Record<MusicType, string> = {
  live: "Live-Musik",
  dj: "DJs",
  both: "Beides",
  none: "Keine Musik",
};

export const GENRES = [
  "Techno / Hardtech / Uptime",
  "Drum & Bass / Jungle / Liquid",
  "Melodic / House",
  "Minimal / Tech House",
  "Psy / Trance / Goa",
  "Rock / Metal / Punk",
  "Pop / Singer-Songwriter",
  "A cappella / Gesang",
  "Instrumental / Trommeln",
  "Rap / Hip-Hop",
  "Jazz / Funk",
  "Latin / Salsa / Reggaeton",
] as const;
export type Genre = (typeof GENRES)[number];
export const MAX_GENRES = 3;

export const HOME_BASES = ["munich", "munich_area", "bavaria", "germany", "abroad"] as const;
export type HomeBase = (typeof HOME_BASES)[number];
export const HOME_BASE_LABELS: Record<HomeBase, string> = {
  munich: "München Stadt",
  munich_area: "Münchener Umland",
  bavaria: "Andere Stadt/Region in Bayern",
  germany: "Andere Stadt/Region in Deutschland",
  abroad: "Im Ausland",
};

export const EVENT_SIZES = ["0", "1-50", "50-200", "200-500", "500-1000", "1000+"] as const;
export type EventSize = (typeof EVENT_SIZES)[number];
export const EVENT_SIZE_LABELS: Record<EventSize, string> = {
  "0": "0 – wir machen keine Events",
  "1-50": "1–50",
  "50-200": "50–200",
  "200-500": "200–500",
  "500-1000": "500–1000",
  "1000+": "> 1000",
};

export const VEHICLES = ["non_motorized", "car", "car_trailer", "truck_small", "truck_large"] as const;
export type Vehicle = (typeof VEHICLES)[number];
export const VEHICLE_LABELS: Record<Vehicle, string> = {
  non_motorized: "Nicht motorisierter Wagen (Bollerwagen, Fahrrad, Soundrucksack etc.)",
  car: "PKW ohne Anhänger",
  car_trailer: "PKW mit Anhänger",
  truck_small: "Kleiner LKW (bis 12 t Gewicht und 10 m Länge)",
  truck_large: "Großer LKW (über 12 t Gewicht oder über 10 m Länge)",
};
/** Short labels for tables, filters and key figures. */
export const VEHICLE_SHORT_LABELS: Record<Vehicle, string> = {
  non_motorized: "Ohne Motor",
  car: "PKW",
  car_trailer: "PKW + Anhänger",
  truck_small: "LKW klein",
  truck_large: "LKW groß",
};

/** Motorized vehicles get the TÜV question and the section lead (spec 031). */
export function isMotorized(vehicle: Vehicle): boolean {
  return vehicle !== "non_motorized";
}

/** Safety vest sizes for the vehicle lead (as in the Google form). */
export const VEST_SIZES = ["S", "L", "XXL"] as const;
export type VestSize = (typeof VEST_SIZES)[number];

export const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];
export const SHIRT_KINDS = ["standard", "soli"] as const;
export type ShirtKind = (typeof SHIRT_KINDS)[number];
export const SHIRT_KIND_LABELS: Record<ShirtKind, string> = {
  standard: "Standard",
  soli: "Soli",
};
export const MAX_SHIRTS_PER_SIZE = 100;

export type ShirtOrder = Record<ShirtKind, Record<ShirtSize, number>>;

export function emptyShirtOrder(): ShirtOrder {
  return {
    standard: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
    soli: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
  };
}

export const REGISTRATION_STATUSES = ["new", "accepted", "waitlist", "rejected"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  new: "Neu",
  accepted: "Zugesagt",
  waitlist: "Warteliste",
  rejected: "Abgesagt",
};

/** Contact address of the organisers, shown on the public pages. */
export const ORGA_EMAIL = "mehr.laerm.fuer.muenchen@gmail.com";
/** Page with the rules for stewards (from the Google form). */
export const STEWARD_RULES_URL = "https://mehrlaermfuermuenchen.jimdofree.com/demoorga/";
