import { createFileRoute } from "@tanstack/react-router";
import { asMember } from "@/server/api";
import { ProjectError } from "@/server/errors";
import * as projects from "@/server/projects";

// The project's Uno firmware as Intel HEX text.
export const Route = createFileRoute("/api/projects_/$projectId/firmware")({
  server: {
    handlers: {
      GET: ({ request, params }: { request: Request; params: { projectId: string } }) =>
        asMember(request, async (user) => {
          const hex = await projects.getFirmware(user, uuid(params.projectId));
          if (hex === null) throw new ProjectError(404, "This project has no firmware.");
          return new Response(hex, { headers: { "content-type": "text/plain; charset=utf-8" } });
        }),
      PUT: ({ request, params }: { request: Request; params: { projectId: string } }) =>
        asMember(request, async (user) => {
          const id = uuid(params.projectId);
          const hex = await request.text();
          if (hex.length > 200_000) throw new ProjectError(400, "The file is too large.");
          return Response.json(await projects.putFirmware(user, id, hex));
        }),
    },
  },
});

function uuid(value: string): string {
  const parsed = projects.idInput.safeParse({ projectId: value });
  if (!parsed.success) throw new ProjectError(404, "Project not found.");
  return parsed.data.projectId;
}
