// Behavior: every frozen feature's main path, F001-F006.
import { readFileSync } from "node:fs";
import { startRuntime, expect, pasteIntoEditor } from "/home/user/oss-new/control/runtime/index.mjs";
import { SIM, apiJson, createProject, editor, importDiagram, startSimulation, wire } from "./lib.mjs";

const doorbellHex = readFileSync(new URL("./fixtures/doorbell.hex", import.meta.url));

const picoCircuit = {
  version: 1,
  parts: [
    { id: "board", type: "pico", x: 40, y: 40, rotation: 0, attrs: {} },
    { id: "led1", type: "led", x: 420, y: 40, rotation: 0, attrs: { color: "red" } },
    { id: "pot1", type: "potentiometer", x: 420, y: 160, rotation: 0, attrs: { value: 100 } },
    { id: "switch1", type: "slide-switch", x: 560, y: 160, rotation: 0, attrs: { position: "right" } },
    { id: "rgb1", type: "rgb-led", x: 560, y: 40, rotation: 0, attrs: {} },
    { id: "buzzer1", type: "buzzer", x: 420, y: 280, rotation: 0, attrs: {} },
  ],
  connections: [
    { from: "led1:A", to: "board:GP15", color: "green" },
    { from: "led1:C", to: "board:GND", color: "black" },
    { from: "pot1:SIG", to: "board:GP26", color: "orange" },
    { from: "pot1:GND", to: "board:GND", color: "black" },
    { from: "pot1:VCC", to: "board:3V3", color: "red" },
    { from: "switch1:2", to: "board:GP5", color: "blue" },
    { from: "switch1:1", to: "board:GND", color: "black" },
    { from: "rgb1:R", to: "board:GP2", color: "red" },
    { from: "rgb1:G", to: "board:GP3", color: "green" },
    { from: "rgb1:COM", to: "board:GND", color: "black" },
    { from: "buzzer1:+", to: "board:GP4", color: "purple" },
    { from: "buzzer1:-", to: "board:GND", color: "black" },
  ],
};

const greenhouseMain = `import helper
import time
from machine import ADC, Pin
Pin(2, Pin.OUT).value(1)
Pin(3, Pin.OUT).value(1)
Pin(4, Pin.OUT).value(1)
name = input('Name? ')
print(helper.greet(name))
pot = ADC(26)
sw = Pin(5, Pin.IN, Pin.PULL_UP)
while True:
    print('level', pot.read_u16() * 100 // 65535, 'switch', sw.value())
    time.sleep(0.3)
`;

const runtime = await startRuntime();
try {
  // Request-level: the JSON routes a personal access token can use.
  expect((await runtime.fetch("/health", { role: "member" })).status).toBe(200);
  const listed = await apiJson(runtime, "/api/projects", "owner");
  expect(listed.status).toBe(200);
  expect(listed.body.projects).toEqual([]);

  const owner = await runtime.context("owner");
  const page = await owner.newPage();
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByTestId("projects-empty")).toBeVisible();

  // F001 + F003 + F004 + F005: an Uno project from its blink example, a
  // button and a second LED wired on the canvas, run with the serial monitor.
  const unoId = await createProject(page, "Doorbell with status light", "uno");
  await expect(page.getByTestId("part-board")).toBeVisible();
  await expect(page.getByTestId("part-led1")).toBeVisible();
  await expect(page.getByTestId("part-r1")).toBeVisible();
  await expect(page.getByTestId("file-tab-sketch.ino")).toBeVisible();
  await expect(page.getByTestId("firmware-info")).toContainText("bytes");
  await expect(page.getByTestId("visibility-badge")).toHaveText("Private");

  await page.getByTestId("add-part").click();
  await page.getByRole("menuitem", { name: "Pushbutton" }).click();
  await expect(page.getByTestId("part-button1")).toBeVisible();
  await wire(page, "button1:1", "board:D2");
  await wire(page, "button1:2", "board:GND");
  await page.getByTestId("add-part").click();
  await page.getByRole("menuitem", { name: /^LED$/ }).click();
  await expect(page.getByTestId("part-led2")).toBeVisible();
  await page.getByTestId("part-led2").click();
  await page.getByTestId("part-attr-color").click();
  await page.getByRole("option", { name: "Green" }).click();
  await expect(page.getByTestId("part-led2")).toHaveAttribute("data-color", "green");
  await wire(page, "led2:A", "board:D12");
  await wire(page, "led2:C", "board:GND");
  await expect(page.getByTestId("wire-row")).toHaveCount(7);
  await page.getByTestId("diagram-save").click();
  await expect(page.getByTestId("diagram-status")).toHaveText("Saved");

  await startSimulation(page);
  const serial = page.getByTestId("serial-output");
  await expect(serial).toContainText("Blink ready", SIM);
  await expect(page.getByTestId("part-led1")).toHaveAttribute("data-on", "true", SIM);
  await expect(page.getByTestId("part-led1")).toHaveAttribute("data-on", "false", SIM);
  await expect.poll(async () => parseFloat(await page.getByTestId("sim-time").innerText()), SIM).toBeGreaterThan(0.5);
  await expect(page.getByTestId("part-led2")).toHaveAttribute("data-on", "false");
  await page.getByTestId("press-button1").hover();
  await page.mouse.down();
  await expect(page.getByTestId("part-led2")).toHaveAttribute("data-on", "true", SIM);
  await page.mouse.up();
  await expect(page.getByTestId("part-led2")).toHaveAttribute("data-on", "false", SIM);
  await page.getByTestId("serial-clear").click();
  await expect(serial).toHaveText("");
  await page.getByTestId("sim-restart").click();
  await expect(serial).toContainText("Blink ready", SIM);
  await page.getByTestId("serial-input").fill("ding dong");
  await page.getByTestId("serial-send").click();
  await expect(serial).toContainText("ding dong", SIM);
  await page.locator("main").evaluate((main) => {
    for (let node = main; node; node = node.parentElement) node.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await expect(page.getByTestId("part-led1")).toHaveAttribute("data-on", "true", SIM);
  await runtime.screenshot(page);
  await page.getByTestId("sim-stop").click();
  await expect(page.getByTestId("sim-start")).toBeVisible();

  // F002: uploaded HEX firmware is checked, replaces the old one and runs.
  await page.getByTestId("firmware-input").setInputFiles({ name: "doorbell.hex", mimeType: "text/plain", buffer: doorbellHex });
  await expect(page.getByTestId("firmware-info")).toContainText("134 bytes", SIM);
  await page.getByTestId("firmware-input").setInputFiles({ name: "notes.hex", mimeType: "text/plain", buffer: Buffer.from("this is not firmware\n") });
  await expect(page.getByTestId("firmware-error")).toBeVisible();
  await expect(page.getByTestId("firmware-info")).toContainText("134 bytes");
  await startSimulation(page);
  await expect(serial).toContainText("Doorbell ready", SIM);
  await page.getByTestId("sim-stop").click();
  const firmware = await runtime.fetch(`/api/projects/${unoId}/firmware`, { role: "owner" });
  expect(firmware.status).toBe(200);
  expect(await firmware.text()).toBe(doorbellHex.toString());

  // F002: files are added, edited, saved, renamed and deleted.
  await page.getByTestId("add-file").click();
  await page.getByTestId("file-name").fill("pins.h");
  await page.getByTestId("file-name-submit").click();
  await expect(page.getByTestId("file-tab-pins.h")).toBeVisible();
  await pasteIntoEditor(page, editor(page), "#define DOORBELL_PIN 2\n#define STATUS_LED 12\n");
  await page.getByTestId("save-file").click();
  await expect(page.getByTestId("file-status")).toHaveText("Saved");
  await page.reload();
  await page.getByTestId("file-tab-pins.h").click();
  await expect(editor(page)).toContainText("#define DOORBELL_PIN 2");
  await expect(editor(page).locator("span").first()).toBeVisible();
  await page.getByTestId("rename-file").click();
  await page.getByTestId("file-name").fill("board_pins.h");
  await page.getByTestId("file-name-submit").click();
  await expect(page.getByTestId("file-tab-board_pins.h")).toBeVisible();
  await expect(page.getByTestId("file-tab-pins.h")).toHaveCount(0);
  await page.getByTestId("delete-file").click();
  await page.getByRole("button", { name: "Delete file" }).click();
  await expect(page.getByTestId("file-tab-board_pins.h")).toHaveCount(0);

  // F004: without firmware the run says what is missing.
  await page.getByTestId("remove-firmware").click();
  await page.getByRole("button", { name: "Remove firmware" }).click();
  await expect(page.getByTestId("firmware-info")).toHaveCount(0);
  await page.getByTestId("sim-start").click();
  await expect(page.getByTestId("sim-message")).toContainText("HEX");
  await expect(page.getByTestId("sim-stop")).toHaveCount(0);
  await page.getByTestId("firmware-input").setInputFiles({ name: "doorbell.hex", mimeType: "text/plain", buffer: doorbellHex });
  await expect(page.getByTestId("firmware-info")).toContainText("134 bytes", SIM);

  // F002 + F004 + F005: a Pico project runs MicroPython with modules, input,
  // the analog and digital inputs, and the RGB LED and buzzer outputs.
  const picoId = await createProject(page, "Greenhouse monitor", "pico");
  await expect(page.getByTestId("file-tab-main.py")).toBeVisible();
  await startSimulation(page);
  await expect(serial).toContainText("Pico ready", SIM);
  await expect(page.getByTestId("part-led1")).toHaveAttribute("data-on", "true", SIM);
  await page.getByTestId("sim-stop").click();

  // F003: export, refused imports, a good import.
  await page.getByTestId("diagram-export").click();
  await expect(page.getByTestId("diagram-export-json")).toContainText('"connections"');
  await page.keyboard.press("Escape");
  const duplicate = structuredClone(picoCircuit);
  duplicate.parts[2].id = "led1";
  await importDiagram(page, duplicate);
  await expect(page.getByTestId("diagram-error")).toContainText('"led1"');
  const badPin = structuredClone(picoCircuit);
  badPin.connections[0].from = "led1:X";
  await page.getByTestId("diagram-json").fill(JSON.stringify(badPin));
  await page.getByTestId("diagram-import-submit").click();
  await expect(page.getByTestId("diagram-error")).toContainText("led1:X");
  await page.getByTestId("diagram-json").fill(JSON.stringify(picoCircuit));
  await page.getByTestId("diagram-import-submit").click();
  await expect(page.getByTestId("part-buzzer1")).toBeVisible();
  await expect(page.getByTestId("wire-row")).toHaveCount(12);
  await page.getByTestId("diagram-save").click();
  await expect(page.getByTestId("diagram-status")).toHaveText("Saved");

  await page.getByTestId("add-file").click();
  await page.getByTestId("file-name").fill("helper.py");
  await page.getByTestId("file-name-submit").click();
  await pasteIntoEditor(page, editor(page), "def greet(name):\n    return 'Hello ' + name\n");
  await page.getByTestId("save-file").click();
  await expect(page.getByTestId("file-status")).toHaveText("Saved");
  await page.getByTestId("file-tab-main.py").click();
  await pasteIntoEditor(page, editor(page), greenhouseMain);
  await page.getByTestId("save-file").click();
  await expect(page.getByTestId("file-status")).toHaveText("Saved");

  await startSimulation(page);
  await expect(serial).toContainText("Name?", SIM);
  await page.getByTestId("serial-input").fill("Ada");
  await page.getByTestId("serial-input").press("Enter");
  await expect(serial).toContainText("Hello Ada", SIM);
  await expect(serial).toContainText("level 100 switch 1", SIM);
  await expect(page.getByTestId("part-rgb1")).toHaveAttribute("data-channels", "RG", SIM);
  await expect(page.getByTestId("part-buzzer1")).toHaveAttribute("data-on", "true", SIM);
  await page.getByTestId("pot-slider-pot1").fill("0");
  await expect(serial).toContainText("level 0 switch 1", SIM);
  await page.getByTestId("toggle-switch1").click();
  await expect(serial).toContainText("level 0 switch 0", SIM);
  await page.getByTestId("sim-stop").click();

  await pasteIntoEditor(page, editor(page), "raise ValueError('sensor offline')\n");
  await startSimulation(page);
  await expect(serial).toContainText("ValueError: sensor offline", SIM);
  await page.getByTestId("sim-stop").click();

  // F003: rotate, re-colour and delete parts and wires; the diagram persists.
  await page.getByTestId("part-led1").click();
  await page.getByTestId("rotate-part").click();
  await expect(page.getByTestId("part-led1")).toHaveAttribute("data-rotation", "90");
  await page.getByTestId("part-buzzer1").click();
  await page.getByTestId("delete-part").click();
  await expect(page.getByTestId("part-buzzer1")).toHaveCount(0);
  await expect(page.getByTestId("wire-row")).toHaveCount(10);
  await page.getByTestId("delete-wire").first().click();
  await expect(page.getByTestId("wire-row")).toHaveCount(9);
  await page.getByTestId("diagram-save").click();
  await expect(page.getByTestId("diagram-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByTestId("part-led1")).toHaveAttribute("data-rotation", "90");
  await expect(page.getByTestId("part-buzzer1")).toHaveCount(0);
  await expect(page.getByTestId("wire-row")).toHaveCount(9);

  // F004: a Pico project without main.py does not start.
  await page.getByTestId("file-tab-main.py").click();
  await page.getByTestId("delete-file").click();
  await page.getByRole("button", { name: "Delete file" }).click();
  await expect(page.getByTestId("file-tab-main.py")).toHaveCount(0);
  await page.getByTestId("sim-start").click();
  await expect(page.getByTestId("sim-message")).toContainText("main.py");

  // F001: the list shows, searches and sorts; rename, share and delete.
  await page.goto("/");
  const rows = page.getByTestId("project-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Greenhouse monitor" })).toContainText("Pico");
  await expect(rows.filter({ hasText: "Doorbell with status light" })).toContainText("Uno");
  await expect(rows.first()).toContainText("Private");
  await page.getByTestId("project-search").fill("green");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Greenhouse monitor");
  await page.getByTestId("project-search").fill("");
  await page.getByTestId("sort-name").click();
  await expect(rows.first()).toContainText("Doorbell with status light");
  await page.getByTestId("sort-name").click();
  await expect(rows.first()).toContainText("Greenhouse monitor");

  await page.goto(`/p/${unoId}`);
  await page.getByTestId("rename-project").click();
  await page.getByTestId("project-name").fill("Front door bell");
  await page.getByTestId("project-name-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Front door bell");
  await page.getByTestId("visibility-toggle").click();
  await expect(page.getByTestId("visibility-badge")).toHaveText("Shared");

  await page.goto(`/p/${picoId}`);
  await page.getByTestId("delete-project").click();
  await Promise.all([page.waitForURL((url) => url.pathname === "/"), page.getByRole("button", { name: "Delete project" }).click()]);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Front door bell");
  await expect(rows.first()).toContainText("Shared");

  // F006: a member finds the shared project, views it read-only, runs it and copies it.
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/");
  await memberPage.getByRole("tab", { name: "Shared" }).click();
  const shared = memberPage.getByTestId("shared-row");
  await expect(shared).toHaveCount(1);
  await expect(shared.first()).toContainText("Front door bell");
  await expect(memberPage.getByTestId("remove-shared")).toHaveCount(0);
  await shared.first().getByRole("link").click();
  await memberPage.waitForURL(`**/p/${unoId}`);
  await expect(memberPage.getByTestId("readonly-notice")).toBeVisible();
  await expect(memberPage.getByTestId("save-file")).toHaveCount(0);
  await expect(memberPage.getByTestId("diagram-save")).toHaveCount(0);
  await expect(memberPage.getByTestId("add-part")).toHaveCount(0);
  await expect(editor(memberPage)).toHaveAttribute("contenteditable", "false");
  await startSimulation(memberPage);
  await expect(memberPage.getByTestId("serial-output")).toContainText("Doorbell ready", SIM);
  await memberPage.getByTestId("sim-stop").click();
  await Promise.all([memberPage.waitForURL((url) => url.pathname.startsWith("/p/") && !url.pathname.endsWith(unoId)), memberPage.getByTestId("copy-project").click()]);
  await expect(memberPage.getByTestId("copied-from")).toContainText("Front door bell");
  await expect(memberPage.getByTestId("visibility-badge")).toHaveText("Private");
  await expect(memberPage.getByTestId("readonly-notice")).toHaveCount(0);
  await expect(memberPage.getByTestId("firmware-info")).toContainText("134 bytes");
  await expect(memberPage.getByTestId("part-led2")).toBeVisible();
  await expect(memberPage.getByTestId("file-tab-sketch.ino")).toBeVisible();
  await memberPage.goto("/");
  await expect(memberPage.getByTestId("project-row")).toHaveCount(1);
  await expect(memberPage.getByTestId("project-row").first()).toContainText("Private");

  // F006: an admin removes another member's shared project.
  const made = await apiJson(runtime, "/api/projects", "member", { method: "POST", body: JSON.stringify({ name: "Night light", board: "pico" }) });
  expect(made.status).toBe(201);
  expect((await apiJson(runtime, `/api/projects/${made.body.id}`, "member", { method: "PATCH", body: JSON.stringify({ visibility: "shared" }) })).status).toBe(200);
  await page.goto("/?tab=shared");
  const nightRow = page.getByTestId("shared-row").filter({ hasText: "Night light" });
  await expect(nightRow).toHaveCount(1);
  await nightRow.getByTestId("remove-shared").click();
  await page.getByRole("button", { name: "Remove project" }).click();
  await expect(nightRow).toHaveCount(0);
  expect((await runtime.fetch(`/api/projects/${made.body.id}`, { role: "member" })).status).toBe(404);

  // Phone-sized smoke.
  const phone = await (await runtime.context("owner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByTestId("new-project")).toBeVisible();
  await expect(phone.getByTestId("project-row").first()).toBeVisible();
  await phone.goto(`/p/${unoId}`);
  await expect(phone.getByTestId("sim-start")).toBeVisible();
  await expect(phone.getByTestId("part-board")).toBeVisible();
} finally {
  await runtime.close();
}
