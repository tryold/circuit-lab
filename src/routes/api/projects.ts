import { createFileRoute } from "@tanstack/react-router";
import { asMember, readJson } from "@/server/api";
import * as projects from "@/server/projects";

// The member's own projects, for clients that hold a personal access token.
export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        asMember(request, async (user) =>
          Response.json({ projects: await projects.listMine(user) }),
        ),
      POST: ({ request }: { request: Request }) =>
        asMember(request, async (user) => {
          const input = projects.createInput.parse(await readJson(request));
          return Response.json(await projects.createProject(user, input), { status: 201 });
        }),
    },
  },
});
