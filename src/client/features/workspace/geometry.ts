import { type Part } from "@/lib/diagram";

type Point = { x: number; y: number };

const UNO_TOP = Array.from({ length: 14 }, (_, i) => `D${i}`);
const UNO_BOTTOM = ["3V3", "5V", "GND", "A0", "A1", "A2", "A3", "A4", "A5"];
const PICO_LEFT = Array.from({ length: 14 }, (_, i) => `GP${i}`);
const PICO_RIGHT = [...Array.from({ length: 9 }, (_, i) => `GP${i + 14}`), "GP26", "GP27", "GP28", "3V3", "GND"];

/** Each part's size and where its pins sit, before rotation. */
export function shape(type: Part["type"]): { w: number; h: number; pins: Record<string, Point> } {
  switch (type) {
    case "uno":
      return {
        w: 340,
        h: 220,
        pins: Object.fromEntries([
          ...UNO_TOP.map((pin, i) => [pin, { x: 40 + i * 20, y: 14 }]),
          ...UNO_BOTTOM.map((pin, i) => [pin, { x: 90 + i * 20, y: 206 }]),
        ]),
      };
    case "pico":
      return {
        w: 150,
        h: 340,
        pins: Object.fromEntries([
          ...PICO_LEFT.map((pin, i) => [pin, { x: 12, y: 30 + i * 22 }]),
          ...PICO_RIGHT.map((pin, i) => [pin, { x: 138, y: 30 + i * 22 }]),
        ]),
      };
    case "led":
      return { w: 30, h: 56, pins: { A: { x: 9, y: 50 }, C: { x: 21, y: 50 } } };
    case "rgb-led":
      return { w: 56, h: 56, pins: { R: { x: 7, y: 50 }, COM: { x: 21, y: 50 }, G: { x: 35, y: 50 }, B: { x: 49, y: 50 } } };
    case "resistor":
      return { w: 80, h: 24, pins: { "1": { x: 6, y: 12 }, "2": { x: 74, y: 12 } } };
    case "pushbutton":
      return { w: 48, h: 56, pins: { "1": { x: 10, y: 50 }, "2": { x: 38, y: 50 } } };
    case "slide-switch":
      return { w: 64, h: 48, pins: { "1": { x: 12, y: 42 }, "2": { x: 32, y: 42 }, "3": { x: 52, y: 42 } } };
    case "potentiometer":
      return { w: 64, h: 68, pins: { GND: { x: 12, y: 62 }, SIG: { x: 32, y: 62 }, VCC: { x: 52, y: 62 } } };
    case "buzzer":
      return { w: 52, h: 60, pins: { "+": { x: 18, y: 54 }, "-": { x: 34, y: 54 } } };
  }
}

/** The transform that turns a part around its centre. */
export function partTransform(part: Part): string {
  const { w, h } = shape(part.type);
  return `translate(${part.x} ${part.y}) rotate(${part.rotation} ${w / 2} ${h / 2})`;
}

export function pinPoint(part: Part, pin: string): Point {
  const { w, h, pins } = shape(part.type);
  const local = pins[pin] ?? { x: 0, y: 0 };
  const angle = (part.rotation * Math.PI) / 180;
  const dx = local.x - w / 2;
  const dy = local.y - h / 2;
  return {
    x: part.x + w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: part.y + h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

export function bounds(parts: Part[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of parts) {
    const { w, h } = shape(part.type);
    const turned = part.rotation % 180 !== 0;
    const [pw, ph] = turned ? [h, w] : [w, h];
    const cx = part.x + w / 2;
    const cy = part.y + h / 2;
    minX = Math.min(minX, cx - pw / 2 - 24);
    minY = Math.min(minY, cy - ph / 2 - 24);
    maxX = Math.max(maxX, cx + pw / 2 + 24);
    maxY = Math.max(maxY, cy + ph / 2 + 24);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, width: 480, height: 280 };
  return { minX, minY, width: Math.max(480, maxX - minX), height: Math.max(280, maxY - minY) };
}

/** A free spot right of the board for a new part. */
export function freeSpot(parts: Part[], type: Part["type"]): Point {
  const board = parts.find((part) => part.id === "board");
  const left = board ? board.x + shape(board.type).w + 50 : 40;
  const { w, h } = shape(type);
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 4; col++) {
      const spot = { x: left + col * 110, y: 40 + row * 100 };
      const clear = parts.every((part) => {
        const other = shape(part.type);
        return (
          spot.x + w + 10 < part.x ||
          part.x + other.w + 10 < spot.x ||
          spot.y + h + 10 < part.y ||
          part.y + other.h + 10 < spot.y
        );
      });
      if (clear) return spot;
    }
  }
  return { x: left, y: 40 };
}

export function nextId(parts: Part[], prefix: string): string {
  let n = 1;
  while (parts.some((part) => part.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

