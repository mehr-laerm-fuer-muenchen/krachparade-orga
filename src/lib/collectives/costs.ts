import { SHIRT_KINDS, SHIRT_SIZES, type ShirtKind, type ShirtOrder } from "./options";

/** Prices in whole euros (spec 031, as in the KP26 form). */
export const DEPOSIT_EUR = 150;
export const TUEV_EUR = 100;
export const SHIRT_PRICE_EUR: Record<ShirtKind, number> = { standard: 30, soli: 40 };

export type RegistrationCosts = {
  deposit: number;
  tuev: number;
  shirtsStandard: number;
  shirtsSoli: number;
  total: number;
};

export function shirtCount(shirts: ShirtOrder, kind: ShirtKind): number {
  return SHIRT_SIZES.reduce((sum, size) => sum + (shirts[kind][size] ?? 0), 0);
}

/** Deposit for every collective, TÜV only when asked for, shirts by kind. */
export function registrationCosts(input: { tuev: boolean | null; shirts: ShirtOrder }): RegistrationCosts {
  const deposit = DEPOSIT_EUR;
  const tuev = input.tuev === true ? TUEV_EUR : 0;
  const [shirtsStandard, shirtsSoli] = SHIRT_KINDS.map(
    (kind) => shirtCount(input.shirts, kind) * SHIRT_PRICE_EUR[kind]
  );
  return { deposit, tuev, shirtsStandard, shirtsSoli, total: deposit + tuev + shirtsStandard + shirtsSoli };
}

/** "1.310 €" */
export function formatEuro(amount: number): string {
  return `${new Intl.NumberFormat("de-DE").format(amount)} €`;
}
