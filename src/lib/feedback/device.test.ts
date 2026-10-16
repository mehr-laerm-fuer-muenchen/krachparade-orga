import { describe, expect, it } from "vitest";
import { describeDevice } from "./device";

const UA = {
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadAsMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("describeDevice", () => {
  it("recognises an iPad", () => {
    expect(describeDevice(UA.ipad, 5)).toBe("iPad · Safari");
  });

  it("recognises an iPad that reports itself as a Mac with touch", () => {
    expect(describeDevice(UA.ipadAsMac, 5)).toBe("iPad · Safari");
  });

  it("keeps a Mac without touch a Mac", () => {
    expect(describeDevice(UA.ipadAsMac, 0)).toBe("Mac · Safari");
    expect(describeDevice(UA.macChrome, 0)).toBe("Mac · Chrome");
  });

  it("recognises iPhone browsers", () => {
    expect(describeDevice(UA.iphone, 5)).toBe("iPhone · Safari");
    expect(describeDevice(UA.iphoneChrome, 5)).toBe("iPhone · Chrome");
  });

  it("recognises Android", () => {
    expect(describeDevice(UA.android, 5)).toBe("Android · Chrome");
  });

  it("recognises Windows browsers", () => {
    expect(describeDevice(UA.windowsEdge, 0)).toBe("Windows · Edge");
    expect(describeDevice(UA.windowsFirefox, 0)).toBe("Windows · Firefox");
  });

  it("falls back for unknown agents", () => {
    expect(describeDevice("", 0)).toBe("Unbekanntes Gerät");
    expect(describeDevice("curl/8.0", 0)).toBe("Unbekanntes Gerät");
  });
});
