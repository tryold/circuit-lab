import { GPIOPinState, Simulator, USBCDC } from "rp2040js";
import { bootromB1 } from "./bootrom";
import type { Machine, SerialSink } from "./machine";

const FLASH_START = 0x10000000;
const PINS = [...Array.from({ length: 23 }, (_, i) => `GP${i}`), "GP26", "GP27", "GP28"];

// MicroPython v1.20.0 for the Pico (MIT licence, micropython.org), served from public/firmware.
let firmware: Promise<Uint8Array> | null = null;
function loadFirmware(): Promise<Uint8Array> {
  firmware ??= fetch("/firmware/micropython-pico.uf2").then(async (response) => {
    if (!response.ok) throw new Error("The MicroPython firmware didn't load.");
    return new Uint8Array(await response.arrayBuffer());
  });
  firmware.catch(() => (firmware = null));
  return firmware;
}

/**
 * MicroPython keeps the project's files on a RAM disk: the setup below
 * mounts one at / through the raw REPL, writes the files, and main.py then
 * runs from the normal REPL.
 */
const RAM_DISK = `import os
class _RB:
 def __init__(s,n):
  s.d=bytearray(n*512)
 def readblocks(s,b,buf,o=0):
  a=b*512+o
  buf[:]=s.d[a:a+len(buf)]
 def writeblocks(s,b,buf,o=0):
  a=b*512+o
  s.d[a:a+len(buf)]=buf
 def ioctl(s,op,arg):
  if op==4:
   return len(s.d)//512
  if op==5:
   return 512
  return 0
try:
 os.umount('/')
except OSError:
 pass
_bd=_RB(256)
os.VfsLfs2.mkfs(_bd)
os.mount(os.VfsLfs2(_bd),'/')
os.chdir('/')
`;

type Phase = "boot" | "raw" | "writing" | "leaving" | "launching" | "running";

/** An RP2040 running MicroPython with the project's .py files. */
export class PicoMachine implements Machine {
  readonly gpioPins = PINS;
  private simulator = new Simulator();
  private cdc: USBCDC;
  private queue: number[] = [];
  private pump: ReturnType<typeof setInterval> | null = null;
  private changed = new Map<string, number>();
  private phase: Phase = "boot";
  private buffer = "";

  constructor(
    private files: { path: string; content: string }[],
    private onSerial: SerialSink,
  ) {
    const mcu = this.simulator.rp2040;
    mcu.loadBootrom(bootromB1);
    mcu.logger = { debug() {}, info() {}, warn() {}, error() {} };
    this.cdc = new USBCDC(mcu.usbCtrl);
    this.cdc.onDeviceConnected = () => this.write("\r\n");
    this.cdc.onSerialData = (data) => this.receive(new TextDecoder().decode(data));
    mcu.uart[0].onByte = (byte) => this.phase === "running" && onSerial(String.fromCharCode(byte));
    mcu.gpio.forEach((gpio, index) =>
      gpio.addListener(() => this.changed.set(`GP${index}`, performance.now())),
    );
  }

  private write(text: string) {
    this.queue.push(...new TextEncoder().encode(text));
  }

  private receive(text: string) {
    if (this.phase === "running") {
      this.onSerial(text);
      return;
    }
    this.buffer += text;
    if (this.phase === "boot" && this.buffer.includes(">>> ")) {
      this.next("raw", "\x01");
    } else if (this.phase === "raw" && this.buffer.includes("CTRL-B to exit\r\n>")) {
      const writes = this.files
        .map((file) => `with open(${JSON.stringify(file.path)},'w') as _f:\n _f.write(${JSON.stringify(file.content)})\n`)
        .join("");
      this.next("writing", `${RAM_DISK}${writes}del _RB,_bd\n\x04`);
    } else if (this.phase === "writing" && /\x04[\s\S]*\x04>$/.test(this.buffer)) {
      const error = this.buffer.split("\x04")[1];
      if (error) this.onSerial(error);
      this.next("leaving", "\x02");
    } else if (this.phase === "leaving" && this.buffer.endsWith(">>> ")) {
      this.next("launching", "exec(open('main.py').read())\r");
    } else if (this.phase === "launching" && this.buffer.includes("\n")) {
      const rest = this.buffer.slice(this.buffer.indexOf("\n") + 1);
      this.phase = "running";
      this.buffer = "";
      if (rest) this.onSerial(rest);
    }
  }

  private next(phase: Phase, send: string) {
    this.phase = phase;
    this.buffer = "";
    this.write(send);
  }

  async start() {
    const uf2 = await loadFirmware();
    const mcu = this.simulator.rp2040;
    for (let offset = 0; offset + 512 <= uf2.length; offset += 512) {
      const view = new DataView(uf2.buffer, uf2.byteOffset + offset, 512);
      const address = view.getUint32(12, true);
      const size = view.getUint32(16, true);
      mcu.flash.set(uf2.subarray(offset + 32, offset + 32 + size), address - FLASH_START);
    }
    mcu.core.PC = FLASH_START;
    this.pump = setInterval(() => {
      while (this.queue.length && !this.cdc.txFIFO.full) this.cdc.sendSerialByte(this.queue.shift()!);
    }, 2);
    this.simulator.execute();
  }

  stop() {
    this.simulator.stop();
    if (this.pump) clearInterval(this.pump);
    this.pump = null;
  }

  private gpio(pin: string) {
    return this.simulator.rp2040.gpio[Number(pin.slice(2))]!;
  }

  output(pin: string) {
    const state = this.gpio(pin).value;
    if (state === GPIOPinState.High) return "high";
    if (state === GPIOPinState.Low) return "low";
    return null;
  }

  pullUp(pin: string) {
    return this.gpio(pin).pullupEnabled;
  }

  lastChange(pin: string) {
    return this.changed.get(pin) ?? -Infinity;
  }

  setDigital(pin: string, high: boolean) {
    const gpio = this.gpio(pin);
    if (gpio.inputValue !== high) gpio.setInputValue(high);
  }

  setAnalog(pin: string, fraction: number) {
    const channel = Number(pin.slice(2)) - 26;
    if (channel >= 0 && channel <= 2) {
      this.simulator.rp2040.adc.channelValues[channel] = Math.round(fraction * 4095);
    }
  }

  sendSerial(text: string) {
    if (this.phase === "running") this.write(text);
  }

  seconds() {
    return this.simulator.clock.nanos / 1e9;
  }
}
