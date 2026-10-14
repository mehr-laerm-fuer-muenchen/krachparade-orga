export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL fehlt. Bitte .env.local anlegen (siehe .env.example) bzw. bei Vercel setzen."
    );
  }
  return value;
}
