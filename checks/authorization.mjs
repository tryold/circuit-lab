// Authorization: private paths, ownership, sharing, admin removal, and no
// sign-in of the app's own (X001).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { apiJson } from "./lib.mjs";

const HEX = ":0400000001C0FFCF6D\n:00000001FF\n";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/?tab=shared", "/api/projects"]);

  const create = (role, name, board = "uno") =>
    apiJson(runtime, "/api/projects", role, { method: "POST", body: JSON.stringify({ name, board }) });
  const ownerPrivate = (await create("owner", "Owner workbench")).body;
  const ownerShared = (await create("owner", "Owner demo", "pico")).body;
  const memberPrivate = (await create("member", "Member sketchpad")).body;
  const memberShared = (await create("member", "Member demo", "pico")).body;
  expect(ownerPrivate.visibility).toBe("private");
  for (const [role, project] of [["owner", ownerShared], ["member", memberShared]]) {
    const shared = await apiJson(runtime, `/api/projects/${project.id}`, role, { method: "PATCH", body: JSON.stringify({ visibility: "shared" }) });
    expect(shared.status).toBe(200);
    expect(shared.body.visibility).toBe("shared");
  }

  // Anonymous and outsiders reach nothing.
  for (const path of [`/api/projects/${ownerShared.id}`, `/api/projects/${ownerShared.id}/firmware`, `/p/${ownerShared.id}`]) {
    expect((await runtime.fetch(path)).status).toBeGreaterThanOrEqual(400);
    expect((await runtime.fetch(path, { role: "outsider" })).status).toBeGreaterThanOrEqual(400);
  }

  // A private project is not found for anyone but its owner, admin included.
  for (const [role, project] of [["member", ownerPrivate], ["owner", memberPrivate]]) {
    const base = `/api/projects/${project.id}`;
    expect((await runtime.fetch(base, { role })).status).toBe(404);
    expect((await runtime.fetch(`${base}/firmware`, { role })).status).toBe(404);
    expect((await apiJson(runtime, base, role, { method: "PATCH", body: JSON.stringify({ name: "Taken" }) })).status).toBe(404);
    expect((await runtime.fetch(`${base}/firmware`, { role, method: "PUT", body: HEX })).status).toBe(404);
    expect((await runtime.fetch(base, { role, method: "DELETE" })).status).toBe(404);
  }
  const ownerList = await apiJson(runtime, "/api/projects", "owner");
  expect(ownerList.body.projects.map((p) => p.name).sort()).toEqual(["Owner demo", "Owner workbench"]);
  const stillThere = await apiJson(runtime, `/api/projects/${ownerPrivate.id}`, "owner");
  expect(stillThere.body.name).toBe("Owner workbench");
  expect((await apiJson(runtime, `/api/projects/${memberPrivate.id}`, "member")).body.name).toBe("Member sketchpad");

  // A shared project is readable by members but changed only by its owner.
  const viewed = await apiJson(runtime, `/api/projects/${ownerShared.id}`, "member");
  expect(viewed.status).toBe(200);
  expect(viewed.body.isOwner).toBe(false);
  expect(viewed.body.files.map((f) => f.path)).toContain("main.py");
  expect((await apiJson(runtime, `/api/projects/${ownerShared.id}`, "member", { method: "PATCH", body: JSON.stringify({ name: "Taken" }) })).status).toBe(403);
  expect((await runtime.fetch(`/api/projects/${ownerShared.id}/firmware`, { role: "member", method: "PUT", body: HEX })).status).toBe(403);
  // Removing a shared project is the owner's or an admin's.
  expect((await runtime.fetch(`/api/projects/${ownerShared.id}`, { role: "member", method: "DELETE" })).status).toBe(403);
  expect((await apiJson(runtime, `/api/projects/${ownerShared.id}`, "owner")).body.name).toBe("Owner demo");
  expect((await runtime.fetch(`/api/projects/${memberShared.id}`, { role: "owner", method: "DELETE" })).status).toBe(200);
  expect((await runtime.fetch(`/api/projects/${memberShared.id}`, { role: "member" })).status).toBe(404);

  // Validation on the server: bad firmware and bad visibility are refused.
  expect((await runtime.fetch(`/api/projects/${ownerPrivate.id}/firmware`, { role: "owner", method: "PUT", body: "not hex" })).status).toBe(400);
  expect((await apiJson(runtime, `/api/projects/${ownerPrivate.id}`, "owner", { method: "PATCH", body: JSON.stringify({ visibility: "public" }) })).status).toBe(400);

  // In the browser: a member can't open the owner's private project, and the
  // shared one is read-only for them.
  const member = await (await runtime.context("member")).newPage();
  await member.goto(`/p/${ownerPrivate.id}`);
  await expect(member.getByTestId("project-not-found")).toBeVisible();
  await expect(member.getByText("Owner workbench")).toHaveCount(0);
  await member.goto("/?tab=shared");
  await expect(member.getByTestId("shared-row")).toHaveCount(1);
  await expect(member.getByTestId("shared-row")).toContainText("Owner demo");
  await member.goto(`/p/${ownerShared.id}`);
  await expect(member.getByTestId("readonly-notice")).toBeVisible();
  for (const id of ["rename-project", "visibility-toggle", "delete-project", "add-file", "save-file", "diagram-save", "add-part", "diagram-import"]) {
    await expect(member.getByTestId(id)).toHaveCount(0);
  }
  await expect(member.getByTestId("copy-project")).toBeVisible();

  // X001: no sign-in, sign-up or password page of the app's own.
  for (const path of ["/login", "/signin", "/signup", "/register", "/logout", "/account"]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status).toBe(404);
  }
  const home = await runtime.fetch("/", { role: "member" });
  expect(await home.text()).not.toMatch(/type="password"/);
  const anonymous = await (await runtime.context(null)).newPage();
  const response = await anonymous.goto("/");
  expect(response.status()).toBeGreaterThanOrEqual(400);
  await expect(anonymous.locator('input[type="password"]')).toHaveCount(0);
} finally {
  await runtime.close();
}
