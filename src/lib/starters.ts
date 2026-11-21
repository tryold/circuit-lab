import type { Board, Diagram } from "./diagram";

/**
 * The prebuilt firmware of the Uno starter (sketch.ino below): 9600-baud
 * serial with a greeting and an echo, D13 blinking, D12 following D2.
 */
export const BLINK_HEX = `
:1000000007E60093C40000E00093C50008E10093F8
:10001000C10006E00093C20000E304B904E00BB99C
:10002000E6E7F0E00591003039F01091C00015FFCF
:10003000FCCF0093C600F6CF88279927AA274A99B4
:1000400002C02C9A01C02C981091C00017FF08C064
:100050000091C6001091C00015FFFCCF0093C600B0
:10006000019669F7A395A93051F7AA2715B120E2A7
:10007000122715B9E4CF426C696E6B20726561641A
:04008000790D0A00EC
:00000001FF
`.trimStart();

const UNO_SKETCH = `// Blinks the LED on pin 13, lights pin 12 while a button on pin 2 is
// held, and echoes back whatever arrives on the serial port.
// The project runs the uploaded HEX firmware built from this sketch.

void setup() {
  Serial.begin(9600);
  Serial.println("Blink ready");
  pinMode(13, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  static unsigned long last = 0;
  digitalWrite(12, digitalRead(2) == LOW);
  if (Serial.available()) {
    Serial.write(Serial.read());
  }
  if (millis() - last >= 500) {
    last = millis();
    digitalWrite(13, !digitalRead(13));
  }
}
`;

const PICO_MAIN = `from machine import Pin
import time

led = Pin(15, Pin.OUT)
print("Pico ready")

while True:
    led.toggle()
    time.sleep(0.5)
`;

export function starterFiles(board: Board): { path: string; content: string }[] {
  return board === "uno"
    ? [{ path: "sketch.ino", content: UNO_SKETCH }]
    : [{ path: "main.py", content: PICO_MAIN }];
}

export function starterDiagram(board: Board): Diagram {
  const pin = board === "uno" ? "D13" : "GP15";
  return {
    version: 1,
    parts: [
      { id: "board", type: board, x: 40, y: 40, rotation: 0, attrs: {} },
      { id: "r1", type: "resistor", x: 420, y: 60, rotation: 0, attrs: { value: "220" } },
      { id: "led1", type: "led", x: 540, y: 40, rotation: 0, attrs: { color: "red" } },
    ],
    connections: [
      { from: `board:${pin}`, to: "r1:1", color: "green" },
      { from: "r1:2", to: "led1:A", color: "green" },
      { from: "led1:C", to: "board:GND", color: "black" },
    ],
  };
}
