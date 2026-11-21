// Persistence: projects, files, diagram and firmware survive a restart.
import { readFileSync } from "node:fs";
import { startRuntime, expect, pasteIntoEditor } from "/home/user/oss-new/control/runtime/index.mjs";
import { apiJson, createProject, editor } from "./lib.mjs";

const doorbellHex = readFileSync(new URL("./fixtures/doorbell.hex", import.meta.url));

const runtime = await startRuntime();
try {
  const page = await (await runtime.context("owner")).newPage();
  const id = await createProject(page, "Weather station", "uno");
  await pasteIntoEditor(page, editor(page), "// reads the wind vane on A0\nvoid setup() {}\nvoid loop() {}\n");
  await page.getByTestId("save-file").click();
  await expect(page.getByTestId("file-status")).toHaveText("Saved");
  await page.getByTestId("add-part").click();
  await page.getByRole("menuitem", { name: "Potentiometer" }).click();
  await expect(page.getByTestId("part-pot1")).toBeVisible();
  await page.getByTestId("diagram-save").click();
  await expect(page.getByTestId("diagram-status")).toHaveText("Saved");
  await page.getByTestId("firmware-input").setInputFiles({ name: "station.hex", mimeType: "text/plain", buffer: doorbellHex });
  await expect(page.getByTestId("firmware-info")).toContainText("134 bytes");

  await runtime.restart();

  const project = await apiJson(runtime, `/api/projects/${id}`, "owner");
  expect(project.status).toBe(200);
  expect(project.body.name).toBe("Weather station");
  expect(project.body.files.find((f) => f.path === "sketch.ino").content).toContain("wind vane");
  expect(project.body.diagram.parts.map((p) => p.id)).toContain("pot1");
  expect(project.body.firmware.size).toBe(134);
  const firmware = await runtime.fetch(`/api/projects/${id}/firmware`, { role: "owner" });
  expect(await firmware.text()).toBe(doorbellHex.toString());

  const again = await (await runtime.context("owner")).newPage();
  await again.goto(`/p/${id}`);
  await expect(again.getByRole("heading", { level: 1 })).toHaveText("Weather station");
  await expect(editor(again)).toContainText("wind vane");
  await expect(again.getByTestId("part-pot1")).toBeVisible();
  await expect(again.getByTestId("firmware-info")).toContainText("134 bytes");
} finally {
  await runtime.close();
}
