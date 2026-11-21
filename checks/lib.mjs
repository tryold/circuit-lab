// Shared steps for the suites. Selectors are the app's test ids.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const SIM = { timeout: 20_000 };

export async function createProject(page, name, board) {
  await page.goto("/");
  await page.getByTestId("new-project").click();
  await page.getByTestId("project-name").fill(name);
  await page.getByRole("radio", { name: board === "pico" ? /Pico/ : /Uno/ }).click();
  await Promise.all([
    page.waitForURL(/\/p\/[^/]+$/),
    page.getByTestId("create-project").click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  return new URL(page.url()).pathname.split("/").pop();
}

export async function apiJson(runtime, path, role, init = {}) {
  const response = await runtime.fetch(path, {
    role,
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

export async function importDiagram(page, diagram) {
  await page.getByTestId("diagram-import").click();
  await page.getByTestId("diagram-json").fill(
    typeof diagram === "string" ? diagram : JSON.stringify(diagram),
  );
  await page.getByTestId("diagram-import-submit").click();
}

export async function wire(page, from, to) {
  await page.getByTestId(`pin-${from.replace(":", "-")}`).click();
  await page.getByTestId(`pin-${to.replace(":", "-")}`).click();
}

export async function startSimulation(page) {
  await page.getByTestId("sim-start").click();
  await expect(page.getByTestId("sim-stop")).toBeVisible(SIM);
}

export function editor(page) {
  return page.getByTestId("code-editor").locator(".cm-content");
}
