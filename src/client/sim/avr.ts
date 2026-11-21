import {
  AVRADC,
  AVRIOPort,
  AVRTimer,
  AVRUSART,
  CPU,
  PinState,
  adcConfig,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  usart0Config,
} from "avr8js";
import { parseIntelHex } from "@/lib/intelHex";
import type { Machine, SerialSink } from "./machine";

const HZ = 16_000_000;
const PINS = [
  ...Array.from({ length: 14 }, (_, i) => `D${i}`),
  ...Array.from({ length: 6 }, (_, i) => `A${i}`),
];

/** An ATmega328P at 16 MHz running Intel HEX firmware. */
export class UnoMachine implements Machine {
  readonly gpioPins = PINS;
  private cpu: CPU;
  private ports: Record<"B" | "C" | "D", AVRIOPort>;
  private usart: AVRUSART;
  private adc: AVRADC;
  private changed = new Map<string, number>();
  private rx: number[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private startCycles = 0;

  constructor(hex: string, onSerial: SerialSink) {
    const program = new Uint16Array(0x4000);
    new Uint8Array(program.buffer).set(parseIntelHex(hex).bytes);
    this.cpu = new CPU(program);
    for (const config of [timer0Config, timer1Config, timer2Config]) new AVRTimer(this.cpu, config);
    this.ports = {
      B: new AVRIOPort(this.cpu, portBConfig),
      C: new AVRIOPort(this.cpu, portCConfig),
      D: new AVRIOPort(this.cpu, portDConfig),
    };
    for (const [name, port] of Object.entries(this.ports)) {
      let previous = 0;
      port.addListener((value) => {
        const flipped = value ^ previous;
        previous = value;
        for (let bit = 0; bit < 8; bit++) {
          if (flipped & (1 << bit)) {
            const pin = this.pinFor(name as "B" | "C" | "D", bit);
            if (pin) this.changed.set(pin, performance.now());
          }
        }
      });
    }
    this.usart = new AVRUSART(this.cpu, usart0Config, HZ);
    this.usart.onByteTransmit = (byte) => onSerial(String.fromCharCode(byte));
    this.adc = new AVRADC(this.cpu, adcConfig);
  }

  private pinFor(port: "B" | "C" | "D", bit: number): string | null {
    if (port === "D") return `D${bit}`;
    if (port === "B") return bit < 6 ? `D${bit + 8}` : null;
    return bit < 6 ? `A${bit}` : null;
  }

  private locate(pin: string): [AVRIOPort, number] {
    const n = Number(pin.slice(1));
    if (pin.startsWith("A")) return [this.ports.C, n];
    return n < 8 ? [this.ports.D, n] : [this.ports.B, n - 8];
  }

  async start() {
    this.startedAt = performance.now();
    this.startCycles = this.cpu.cycles;
    const run = () => {
      const target = this.startCycles + ((performance.now() - this.startedAt) / 1000) * HZ;
      const deadline = performance.now() + 12;
      while (this.cpu.cycles < target && performance.now() < deadline) {
        for (let i = 0; i < 2000; i++) {
          avrInstruction(this.cpu);
          this.cpu.tick();
        }
      }
      if (this.rx.length && this.usart.writeByte(this.rx[0]!)) this.rx.shift();
      this.timer = setTimeout(run, 0);
    };
    run();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  output(pin: string) {
    const [port, bit] = this.locate(pin);
    const state = port.pinState(bit);
    if (state === PinState.High) return "high";
    if (state === PinState.Low) return "low";
    return null;
  }

  pullUp(pin: string) {
    const [port, bit] = this.locate(pin);
    return port.pinState(bit) === PinState.InputPullUp;
  }

  lastChange(pin: string) {
    return this.changed.get(pin) ?? -Infinity;
  }

  setDigital(pin: string, high: boolean) {
    const [port, bit] = this.locate(pin);
    port.setPin(bit, high);
  }

  setAnalog(pin: string, fraction: number) {
    if (pin.startsWith("A")) this.adc.channelValues[Number(pin.slice(1))] = fraction * 5;
  }

  sendSerial(text: string) {
    for (const char of text) this.rx.push(char.charCodeAt(0) & 0xff);
  }

  seconds() {
    return this.cpu.cycles / HZ;
  }
}
