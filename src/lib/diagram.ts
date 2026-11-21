import { z } from "zod";

export const BOARDS = ["uno", "pico"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_LABELS: Record<Board, string> = {
  uno: "Uno",
  pico: "Pico",
};

const UNO_PINS = [
  ...Array.from({ length: 14 }, (_, i) => `D${i}`),
  ...Array.from({ length: 6 }, (_, i) => `A${i}`),
  "GND",
  "5V",
  "3V3",
];
const PICO_PINS = [
  ...Array.from({ length: 23 }, (_, i) => `GP${i}`),
  "GP26",
  "GP27",
  "GP28",
  "GND",
  "3V3",
];

export const PART_TYPES = [
  "led",
  "rgb-led",
  "resistor",
  "pushbutton",
  "slide-switch",
  "potentiometer",
  "buzzer",
] as const;
export type PartType = (typeof PART_TYPES)[number];

/** Every part's pins, the boards' included. */
const PINS: Record<Board | PartType, string[]> = {
  uno: UNO_PINS,
  pico: PICO_PINS,
  led: ["A", "C"],
  "rgb-led": ["R", "G", "B", "COM"],
  resistor: ["1", "2"],
  pushbutton: ["1", "2"],
  "slide-switch": ["1", "2", "3"],
  potentiometer: ["GND", "SIG", "VCC"],
  buzzer: ["+", "-"],
};

export const PART_LABELS: Record<PartType, string> = {
  led: "LED",
  "rgb-led": "RGB LED",
  resistor: "Resistor",
  pushbutton: "Pushbutton",
  "slide-switch": "Slide switch",
  potentiometer: "Potentiometer",
  buzzer: "Buzzer",
};

/** The prefix of a new part's id: led1, rgb1, r1, button1, ... */
export const ID_PREFIX: Record<PartType, string> = {
  led: "led",
  "rgb-led": "rgb",
  resistor: "r",
  pushbutton: "button",
  "slide-switch": "switch",
  potentiometer: "pot",
  buzzer: "buzzer",
};

export const LED_COLORS = ["red", "green", "blue", "yellow", "orange", "white"] as const;
export const WIRE_COLORS = ["green", "red", "black", "blue", "orange", "purple", "yellow"] as const;

export const DEFAULT_ATTRS: Record<PartType, Record<string, string | number>> = {
  led: { color: "red" },
  "rgb-led": {},
  resistor: { value: "220" },
  pushbutton: { color: "red" },
  "slide-switch": { position: "right" },
  potentiometer: { value: 50 },
  buzzer: {},
};

const partSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/, "Part ids are letters, digits, - and _"),
    type: z.enum([...BOARDS, ...PART_TYPES]),
    x: z.number().finite().min(-2000).max(5000),
    y: z.number().finite().min(-2000).max(5000),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    attrs: z.record(z.string(), z.union([z.string().max(40), z.number().finite()])),
  })
  .strict();

const connectionSchema = z
  .object({
    from: z.string().max(80),
    to: z.string().max(80),
    color: z.enum(WIRE_COLORS),
  })
  .strict();

export const diagramSchema = z
  .object({
    version: z.literal(1),
    parts: z.array(partSchema).max(100),
    connections: z.array(connectionSchema).max(400),
  })
  .strict();

export type Diagram = z.infer<typeof diagramSchema>;
export type Part = Diagram["parts"][number];

/** A diagram for this board, or the reason it can't be one. */
export function checkDiagram(
  input: unknown,
  board: Board,
): { ok: true; diagram: Diagram } | { ok: false; error: string } {
  const parsed = diagramSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.length ? ` at ${issue.path.join(".")}` : "";
    return { ok: false, error: `Not a valid diagram${where}: ${issue.message}` };
  }
  const diagram = parsed.data;
  const types = new Map<string, Part["type"]>();
  for (const part of diagram.parts) {
    if (types.has(part.id)) {
      return { ok: false, error: `Two parts use the id "${part.id}".` };
    }
    types.set(part.id, part.type);
  }
  const boards = diagram.parts.filter((part) => (BOARDS as readonly string[]).includes(part.type));
  if (boards.length !== 1 || boards[0]!.type !== board || boards[0]!.id !== "board") {
    return { ok: false, error: `The diagram needs exactly one ${BOARD_LABELS[board]} board with the id "board".` };
  }
  for (const [index, wire] of diagram.connections.entries()) {
    for (const end of [wire.from, wire.to]) {
      const [id, pin] = end.split(":");
      const type = id ? types.get(id) : undefined;
      if (!type || !pin || !PINS[type].includes(pin)) {
        return { ok: false, error: `Wire ${index + 1} connects to an unknown pin "${end}".` };
      }
    }
    if (wire.from === wire.to) {
      return { ok: false, error: `Wire ${index + 1} connects "${wire.from}" to itself.` };
    }
  }
  return { ok: true, diagram };
}
