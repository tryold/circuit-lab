/** A simulated board the circuit talks to by pin name (D13, A0, GP15, ...). */
export interface Machine {
  /** The board's GPIO pins, by name. */
  readonly gpioPins: readonly string[];
  start(): Promise<void>;
  stop(): void;
  /** What the chip drives on a pin: high, low, or nothing (an input). */
  output(pin: string): "high" | "low" | null;
  /** Whether an input pin has its pull-up on. */
  pullUp(pin: string): boolean;
  /** When the pin last changed level, in performance.now() milliseconds. */
  lastChange(pin: string): number;
  setDigital(pin: string, high: boolean): void;
  /** Sets an analog input from 0 to 1 of the reference voltage. */
  setAnalog(pin: string, fraction: number): void;
  sendSerial(text: string): void;
  /** Simulated seconds since start. */
  seconds(): number;
}

export type SerialSink = (text: string) => void;
