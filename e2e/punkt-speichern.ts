import type { Locator } from "@playwright/test";

/** True where the app uses the touch behaviour (spec 028): Enter adds a line there. */
export async function isTouch(form: Locator): Promise<boolean> {
  return form.page().evaluate(() => window.matchMedia("(pointer: coarse)").matches);
}

/**
 * Saves the item in a "Neuer Punkt" or "Punkt bearbeiten" form the way a
 * person would: Enter in the text field on a laptop, the "Speichern" button
 * on a phone.
 */
export async function savePoint(form: Locator): Promise<void> {
  if (await isTouch(form)) {
    await form.getByRole("button", { name: "Speichern", exact: true }).click();
  } else {
    await form.getByRole("textbox", { name: "Text" }).press("Enter");
  }
}
