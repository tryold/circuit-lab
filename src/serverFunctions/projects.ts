import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { ProjectError } from "@/server/errors";
import * as projects from "@/server/projects";

// Every function runs behind ensureUserMiddleware: `context.user` is the
// member the Gateway signed in, and every query checks what they may do.

export const getProjectLists = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await projects.rememberUser(user);
    const [mine, shared] = await Promise.all([
      projects.listMine(user),
      projects.listShared(user),
    ]);
    return { mine, shared };
  });

/** The project, or null when it doesn't exist or isn't this member's to see. */
export const getProject = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ projectId: z.string() }).parse(data))
  .handler(async ({ data, context: { user } }) => {
    if (!z.string().uuid().safeParse(data.projectId).success) return null;
    try {
      return await projects.getProject(user, data.projectId);
    } catch (error) {
      if (error instanceof ProjectError && error.status === 404) return null;
      throw error;
    }
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.createInput.parse(data))
  .handler(async ({ data, context }) => {
    const project = await projects.createProject(context.user, data);
    return { id: project.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    projects.idInput.extend(projects.updateInput.shape).strict().parse(data),
  )
  .handler(async ({ data: { projectId, ...change }, context }) => {
    await projects.updateProject(context.user, projectId, change);
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.idInput.parse(data))
  .handler(({ data, context }) => projects.deleteProject(context.user, data.projectId));

export const copyProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const copy = await projects.copyProject(context.user, data.projectId);
    return { id: copy.id };
  });

export const saveFile = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.fileInput.parse(data))
  .handler(({ data, context }) => projects.saveFile(context.user, data));

export const addFile = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.fileInput.parse(data))
  .handler(({ data, context }) => projects.addFile(context.user, data));

export const renameFile = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.renameFileInput.parse(data))
  .handler(({ data, context }) => projects.renameFile(context.user, data));

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.fileInput.parse(data))
  .handler(({ data, context }) => projects.deleteFile(context.user, data));

export const saveDiagram = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.diagramInput.parse(data))
  .handler(({ data, context }) => projects.saveDiagram(context.user, data));

export const uploadFirmware = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.firmwareInput.parse(data))
  .handler(({ data, context }) =>
    projects.putFirmware(context.user, data.projectId, data.hex),
  );

export const removeFirmware = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.idInput.parse(data))
  .handler(({ data, context }) => projects.removeFirmware(context.user, data.projectId));

export const getFirmware = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => projects.idInput.parse(data))
  .handler(({ data, context }) => projects.getFirmware(context.user, data.projectId));
