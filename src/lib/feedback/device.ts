/**
 * Short device description from the user agent, e.g. "iPhone · Safari" or
 * "Windows · Edge" (spec 014). iPadOS reports itself as a Mac; a Mac user
 * agent with more than one touch point is therefore an iPad.
 */
export function describeDevice(userAgent: string, maxTouchPoints: number): string {
  const system = detectSystem(userAgent, maxTouchPoints);
  if (!system) return "Unbekanntes Gerät";
  const browser = detectBrowser(userAgent);
  return browser ? `${system} · ${browser}` : system;
}

function detectSystem(ua: string, maxTouchPoints: number): string | null {
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return maxTouchPoints > 1 ? "iPad" : "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function detectBrowser(ua: string): string | null {
  // Order matters: Edge, Opera and Samsung Internet also contain "Chrome",
  // and every browser on iOS contains "Safari".
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}
