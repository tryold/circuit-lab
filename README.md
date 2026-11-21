# Circuit Lab

Build microcontroller circuits, write their code and run them on a simulated Uno or Pico in the browser, then share projects with your team.

Inspired by https://wokwi.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create Uno or Pico projects from a blink example, then list, search, sort, rename, share and delete them.
- Edit project files in a code editor; Pico projects run MicroPython and Uno projects run uploaded Intel HEX firmware.
- Wire LEDs, an RGB LED, resistors, buttons, switches, potentiometers and buzzers to the board, and import or export the diagram as JSON.
- Run, stop and restart the simulated chip and watch the parts respond while you press, flip and turn the inputs.
- Read the program's serial output and send it lines in the serial monitor.
- Share a project with every member, who can open, run and copy it; admins can remove shared projects.

Left out: accounts and sign-in, which your Gateway handles; compiling C/C++ sketches and the library manager; other boards, Wi-Fi and the wider part catalogue; debuggers, logic analyzer and IDE plugins; pricing, classrooms and the public gallery.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` for the unit tests; `checks/` holds the release suites, run by oss.new against the packaged app.
- Deploy: `pnpm run deploy` to your EveryApp Gateway. The app needs a D1 database and an R2 bucket, which the deploy creates. There are no secrets or settings to fill in.

## Limitations

- Uno projects can't compile code: build the HEX file elsewhere (for example with the Arduino IDE's "Export compiled binary") and upload it. The source files are kept for reference.
- Pico projects run MicroPython 1.20. Files live on a RAM disk that is rebuilt on every run, so anything the program writes is lost when it stops.
- The circuit is logical, not electrical: a resistor or switch conducts or not, and LEDs light from pin levels rather than currents.
- The simulation runs in the browser tab and can run slower than real time on a busy machine.
- Real deployment behind a Gateway was not exercised here; the checks run against the packaged release locally.
