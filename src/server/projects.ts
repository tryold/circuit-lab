import { and, asc, desc, eq, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { z } from "zod";
import { db } from "@/db";
import { projectFiles, projects, users } from "@/db/schema";
import { BOARDS, checkDiagram, type Board, type Diagram } from "@/lib/diagram";
import { parseIntelHex } from "@/lib/intelHex";
import { BLINK_HEX, starterDiagram, starterFiles } from "@/lib/starters";
import { notFound, ownerOnly, ProjectError } from "./errors";

type User = Pick<EveryAppUser, "id" | "email" | "orgId" | "orgRole">;
type ProjectRow = typeof projects.$inferSelect;

const name = z.string().trim().min(1, "Give the project a name").max(80);
const filePath = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/,
    "File names use letters, digits, '.', '-' and '_'",
  );
const content = z.string().max(200_000, "The file is too large");
const id = z.string().uuid();

export const createInput = z.object({ name, board: z.enum(BOARDS) }).strict();
export const updateInput = z
  .object({
    name: name.optional(),
    visibility: z.enum(["private", "shared"]).optional(),
  })
  .strict();
export const idInput = z.object({ projectId: id }).strict();
export const fileInput = z
  .object({ projectId: id, path: filePath, content: content.optional() })
  .strict();
export const renameFileInput = z
  .object({ projectId: id, path: filePath, newPath: filePath })
  .strict();
export const diagramInput = z
  .object({ projectId: id, diagram: z.unknown() })
  .strict();
export const firmwareInput = z
  .object({ projectId: id, hex: z.string().max(200_000) })
  .strict();

const MAX_FILES = 30;
const firmwareKey = (projectId: string) => `projects/${projectId}/firmware.hex`;
const stamp = () => new Date().toISOString();

/** Records the member on first sight and keeps their email current. */
export async function rememberUser(user: User): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}

const listed = {
  id: projects.id,
  name: projects.name,
  board: projects.board,
  visibility: projects.visibility,
  updatedAt: projects.updatedAt,
};

export function listMine(user: User) {
  return db
    .select(listed)
    .from(projects)
    .where(eq(projects.ownerId, user.id))
    .orderBy(desc(projects.updatedAt));
}

export async function listShared(user: User) {
  const rows = await db
    .select({ ...listed, ownerId: projects.ownerId, ownerEmail: users.email })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(and(eq(projects.orgId, user.orgId), eq(projects.visibility, "shared")))
    .orderBy(desc(projects.updatedAt));
  return rows.map(({ ownerId, ...row }) => ({
    ...row,
    ownerEmail: row.ownerEmail ?? "",
    isOwner: ownerId === user.id,
    canRemove: ownerId === user.id || isAdmin(user),
  }));
}

/** The project when this user may see it: their own, or shared in their organization. */
async function viewable(user: User, projectId: string): Promise<ProjectRow> {
  const [row] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        or(
          eq(projects.ownerId, user.id),
          and(eq(projects.orgId, user.orgId), eq(projects.visibility, "shared")),
        ),
      ),
    );
  if (!row) throw notFound();
  return row;
}

async function owned(user: User, projectId: string): Promise<ProjectRow> {
  const row = await viewable(user, projectId);
  if (row.ownerId !== user.id) throw ownerOnly();
  return row;
}

const touch = (projectId: string) =>
  db.update(projects).set({ updatedAt: stamp() }).where(eq(projects.id, projectId));

export async function getProject(user: User, projectId: string) {
  const row = await viewable(user, projectId);
  const [files, [owner]] = await Promise.all([
    db
      .select({ path: projectFiles.path, content: projectFiles.content })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, row.id))
      .orderBy(asc(projectFiles.path)),
    db.select({ email: users.email }).from(users).where(eq(users.id, row.ownerId)),
  ]);
  const isOwner = row.ownerId === user.id;
  return {
    id: row.id,
    name: row.name,
    board: row.board as Board,
    visibility: row.visibility,
    isOwner,
    canRemove: isOwner || (row.visibility === "shared" && isAdmin(user)),
    ownerEmail: owner?.email ?? "",
    copiedFrom: row.copiedFromName
      ? { id: row.copiedFromId, name: row.copiedFromName }
      : null,
    updatedAt: row.updatedAt,
    diagram: JSON.parse(row.diagram) as Diagram,
    firmware:
      row.firmwareSize !== null && row.firmwareUploadedAt
        ? { size: row.firmwareSize, uploadedAt: row.firmwareUploadedAt }
        : null,
    files,
  };
}

export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;

export async function createProject(
  user: User,
  input: z.infer<typeof createInput>,
): Promise<ProjectDetail> {
  await rememberUser(user);
  const projectId = crypto.randomUUID();
  const firmware = input.board === "uno" ? parseIntelHex(BLINK_HEX) : null;
  if (firmware) await env.files.put(firmwareKey(projectId), BLINK_HEX);
  const now = stamp();
  await db.batch([
    db.insert(projects).values({
      id: projectId,
      ownerId: user.id,
      orgId: user.orgId,
      name: input.name,
      board: input.board,
      diagram: JSON.stringify(starterDiagram(input.board)),
      firmwareSize: firmware?.size ?? null,
      firmwareUploadedAt: firmware ? now : null,
      createdAt: now,
      updatedAt: now,
    }),
    ...starterFiles(input.board).map((file) =>
      db.insert(projectFiles).values({ id: crypto.randomUUID(), projectId, ...file }),
    ),
  ]);
  return getProject(user, projectId);
}

export async function updateProject(
  user: User,
  projectId: string,
  change: z.infer<typeof updateInput>,
): Promise<ProjectDetail> {
  await owned(user, projectId);
  await db
    .update(projects)
    .set({ ...change, updatedAt: stamp() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)));
  return getProject(user, projectId);
}

/** The owner deletes any of theirs; an admin removes any shared project. */
export async function deleteProject(user: User, projectId: string): Promise<void> {
  const row = await viewable(user, projectId);
  const allowed = row.ownerId === user.id || (row.visibility === "shared" && isAdmin(user));
  if (!allowed) throw ownerOnly();
  await db.batch([
    db.delete(projectFiles).where(eq(projectFiles.projectId, row.id)),
    db.delete(projects).where(eq(projects.id, row.id)),
  ]);
  await env.files.delete(firmwareKey(row.id));
}

export async function saveFile(user: User, input: z.infer<typeof fileInput>) {
  await owned(user, input.projectId);
  const [file] = await db
    .update(projectFiles)
    .set({ content: input.content ?? "", updatedAt: stamp() })
    .where(and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.path, input.path)))
    .returning({ path: projectFiles.path });
  if (!file) throw new ProjectError(404, `There is no file named ${input.path}.`);
  await touch(input.projectId);
}

export async function addFile(user: User, input: z.infer<typeof fileInput>) {
  await owned(user, input.projectId);
  const existing = await db
    .select({ path: projectFiles.path })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, input.projectId));
  if (existing.some((file) => file.path === input.path)) {
    throw new ProjectError(409, `There is already a file named ${input.path}.`);
  }
  if (existing.length >= MAX_FILES) {
    throw new ProjectError(400, `A project holds at most ${MAX_FILES} files.`);
  }
  await db.batch([
    db.insert(projectFiles).values({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      path: input.path,
      content: input.content ?? "",
    }),
    touch(input.projectId),
  ]);
}

export async function renameFile(user: User, input: z.infer<typeof renameFileInput>) {
  await owned(user, input.projectId);
  if (input.path === input.newPath) return;
  const [clash] = await db
    .select({ path: projectFiles.path })
    .from(projectFiles)
    .where(and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.path, input.newPath)));
  if (clash) throw new ProjectError(409, `There is already a file named ${input.newPath}.`);
  await db.batch([
    db
      .update(projectFiles)
      .set({ path: input.newPath, updatedAt: stamp() })
      .where(and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.path, input.path))),
    touch(input.projectId),
  ]);
}

export async function deleteFile(user: User, input: z.infer<typeof fileInput>) {
  await owned(user, input.projectId);
  await db.batch([
    db
      .delete(projectFiles)
      .where(and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.path, input.path))),
    touch(input.projectId),
  ]);
}

export async function saveDiagram(user: User, input: z.infer<typeof diagramInput>) {
  const row = await owned(user, input.projectId);
  const checked = checkDiagram(input.diagram, row.board as Board);
  if (!checked.ok) throw new ProjectError(400, checked.error);
  await db
    .update(projects)
    .set({ diagram: JSON.stringify(checked.diagram), updatedAt: stamp() })
    .where(eq(projects.id, row.id));
}

export async function putFirmware(user: User, projectId: string, hex: string) {
  const row = await owned(user, projectId);
  if (row.board !== "uno") {
    throw new ProjectError(400, "Pico projects run MicroPython, not HEX firmware.");
  }
  let size: number;
  try {
    size = parseIntelHex(hex).size;
  } catch (error) {
    throw new ProjectError(400, error instanceof Error ? error.message : "Not a HEX file.");
  }
  const now = stamp();
  await env.files.put(firmwareKey(row.id), hex);
  await db
    .update(projects)
    .set({ firmwareSize: size, firmwareUploadedAt: now, updatedAt: now })
    .where(eq(projects.id, row.id));
  return { size, uploadedAt: now };
}

export async function removeFirmware(user: User, projectId: string) {
  const row = await owned(user, projectId);
  await db
    .update(projects)
    .set({ firmwareSize: null, firmwareUploadedAt: null, updatedAt: stamp() })
    .where(eq(projects.id, row.id));
  await env.files.delete(firmwareKey(row.id));
}

/** The HEX text, or null when the project has none. */
export async function getFirmware(user: User, projectId: string): Promise<string | null> {
  const row = await viewable(user, projectId);
  if (row.firmwareSize === null) return null;
  const object = await env.files.get(firmwareKey(row.id));
  return object ? object.text() : null;
}

/** A private copy for this user, with a note of where it came from. */
export async function copyProject(user: User, projectId: string): Promise<ProjectDetail> {
  await rememberUser(user);
  const source = await viewable(user, projectId);
  const files = await db
    .select({ path: projectFiles.path, content: projectFiles.content })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, source.id));
  const copyId = crypto.randomUUID();
  const hex = await getFirmware(user, source.id);
  if (hex) await env.files.put(firmwareKey(copyId), hex);
  const now = stamp();
  await db.batch([
    db.insert(projects).values({
      id: copyId,
      ownerId: user.id,
      orgId: user.orgId,
      name: `${source.name} (copy)`.slice(0, 80),
      board: source.board,
      visibility: "private",
      diagram: source.diagram,
      firmwareSize: hex ? source.firmwareSize : null,
      firmwareUploadedAt: hex ? source.firmwareUploadedAt : null,
      copiedFromId: source.id,
      copiedFromName: source.name,
      createdAt: now,
      updatedAt: now,
    }),
    ...files.map((file) =>
      db.insert(projectFiles).values({ id: crypto.randomUUID(), projectId: copyId, ...file }),
    ),
  ]);
  return getProject(user, copyId);
}
