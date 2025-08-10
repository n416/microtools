function getNextAvailableColor(existingColors = []) {
  const baseHueStep = 45;
  const baseSaturation = 70;
  const baseLightness = 50;
  const lightnessSteps = [0, -10, 10, -20, 20, -30, 30, -40, 40];

  const existingHues = existingColors
    .map((hex) => {
      if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return null;
      const {h} = hexToHsl(hex);
      return h;
    })
    .filter((h) => h !== null);

  for (const lStep of lightnessSteps) {
    const currentLightness = baseLightness + lStep;
    for (let i = 0; i < 8; i++) {
      const targetHue = i * baseHueStep;
      const isTaken = existingHues.some((h) => Math.abs(h - targetHue) < baseHueStep / 2 || Math.abs(h - targetHue) > 360 - baseHueStep / 2);
      if (!isTaken) {
        return hslToHex(targetHue, baseSaturation, currentLightness);
      }
    }
  }
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')}`;
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;
  if (0 <= h && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (60 <= h && h < 180) {
    [r, g, b] = [x, c, 0];
  } else if (120 <= h && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (180 <= h && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (240 <= h && h < 300) {
    [r, g, b] = [x, 0, c];
  } else if (300 <= h && h < 360) {
    [r, g, b] = [c, 0, x];
  }
  r = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, '0');
  g = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, '0');
  b = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255;
  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max == min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {h: h * 360, s: s * 100, l: l * 100};
}

module.exports = {
  getNextAvailableColor,
  hslToHex,
  hexToHsl,
};
