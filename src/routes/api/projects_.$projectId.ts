import { createFileRoute } from "@tanstack/react-router";
import { asMember, readJson } from "@/server/api";
import { ProjectError } from "@/server/errors";
import * as projects from "@/server/projects";

export const Route = createFileRoute("/api/projects_/$projectId")({
  server: {
    handlers: {
      GET: ({ request, params }: { request: Request; params: { projectId: string } }) =>
        asMember(request, async (user) =>
          Response.json(await projects.getProject(user, uuid(params.projectId))),
        ),
      PATCH: ({ request, params }: { request: Request; params: { projectId: string } }) =>
        asMember(request, async (user) => {
          const id = uuid(params.projectId);
          const change = projects.updateInput.parse(await readJson(request));
          return Response.json(await projects.updateProject(user, id, change));
        }),
      DELETE: ({ request, params }: { request: Request; params: { projectId: string } }) =>
        asMember(request, async (user) => {
          await projects.deleteProject(user, uuid(params.projectId));
          return Response.json({ deleted: true });
        }),
    },
  },
});

function uuid(value: string): string {
  const parsed = projects.idInput.safeParse({ projectId: value });
  if (!parsed.success) throw new ProjectError(404, "Project not found.");
  return parsed.data.projectId;
}
