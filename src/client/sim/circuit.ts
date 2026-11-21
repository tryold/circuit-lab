import type { Diagram, Part } from "@/lib/diagram";
import type { Machine } from "./machine";

/** What each output part shows, by part id. */
export interface PartStates {
  on: Record<string, boolean>;
  /** The RGB LED channels that are lit, as "R", "RG", "RGB", ... */
  channels: Record<string, string>;
}

export interface Inputs {
  pressed: Record<string, boolean>;
  switches: Record<string, "left" | "right">;
  pots: Record<string, number>;
}

const POWER = new Set(["5V", "3V3"]);
const BUZZ_WINDOW_MS = 120;

class Nets {
  private parent = new Map<string, string>();
  find(node: string): string {
    let root = node;
    while (this.parent.has(root) && this.parent.get(root) !== root) root = this.parent.get(root)!;
    this.parent.set(node, root);
    return root;
  }
  join(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function connectivity(diagram: Diagram, inputs: Inputs): Nets {
  const nets = new Nets();
  for (const wire of diagram.connections) nets.join(wire.from, wire.to);
  for (const part of diagram.parts) {
    if (part.type === "resistor") nets.join(`${part.id}:1`, `${part.id}:2`);
    if (part.type === "pushbutton" && inputs.pressed[part.id]) {
      nets.join(`${part.id}:1`, `${part.id}:2`);
    }
    if (part.type === "slide-switch") {
      const position = inputs.switches[part.id] ?? part.attrs.position;
      nets.join(`${part.id}:2`, position === "left" ? `${part.id}:1` : `${part.id}:3`);
    }
  }
  return nets;
}

/**
 * Settles the circuit for one moment: reads the chip's outputs, feeds its
 * inputs, and says which parts are lit or sounding. Resistors conduct, a
 * pressed button or a switch joins its pins, and a level comes from a
 * ground or power pin or a pin the chip drives.
 */
export function settle(diagram: Diagram, machine: Machine, inputs: Inputs, now: number): PartStates {
  const nets = connectivity(diagram, inputs);
  const levels = new Map<string, "high" | "low">();
  const drive = (node: string, level: "high" | "low") => {
    const net = nets.find(node);
    if (levels.get(net) !== "low") levels.set(net, level);
  };
  drive("board:GND", "low");
  for (const pin of POWER) drive(`board:${pin}`, "high");
  for (const pin of machine.gpioPins) {
    const level = machine.output(pin);
    if (level) drive(`board:${pin}`, level);
  }
  const level = (node: string) => levels.get(nets.find(node)) ?? null;

  const pots = diagram.parts.filter((part) => part.type === "potentiometer");
  for (const pin of machine.gpioPins) {
    if (machine.output(pin)) continue;
    const node = `board:${pin}`;
    const pot = pots.find((part) => nets.find(`${part.id}:SIG`) === nets.find(node));
    if (pot) {
      const powered = level(`${pot.id}:VCC`) === "high" && level(`${pot.id}:GND`) === "low";
      const fraction = powered ? potValue(pot, inputs) / 100 : 0;
      machine.setAnalog(pin, fraction);
      machine.setDigital(pin, fraction > 0.5);
      continue;
    }
    const value = level(node);
    machine.setAnalog(pin, value === "high" ? 1 : 0);
    machine.setDigital(pin, value ? value === "high" : machine.pullUp(pin));
  }

  const lit = (anode: string, cathode: string) =>
    level(anode) === "high" && level(cathode) === "low";
  const toggling = (node: string) =>
    machine.gpioPins.some(
      (pin) =>
        nets.find(`board:${pin}`) === nets.find(node) &&
        now - machine.lastChange(pin) < BUZZ_WINDOW_MS,
    );
  const states: PartStates = { on: {}, channels: {} };
  for (const part of diagram.parts) {
    if (part.type === "led") states.on[part.id] = lit(`${part.id}:A`, `${part.id}:C`);
    if (part.type === "rgb-led") {
      states.channels[part.id] = ["R", "G", "B"]
        .filter((channel) => lit(`${part.id}:${channel}`, `${part.id}:COM`))
        .join("");
    }
    if (part.type === "buzzer") {
      states.on[part.id] =
        level(`${part.id}:-`) === "low" &&
        (level(`${part.id}:+`) === "high" || toggling(`${part.id}:+`));
    }
  }
  return states;
}

function potValue(part: Part, inputs: Inputs): number {
  return inputs.pots[part.id] ?? Number(part.attrs.value ?? 50);
}

export const IDLE: PartStates = { on: {}, channels: {} };
