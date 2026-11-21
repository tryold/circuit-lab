import { env } from "cloudflare:workers";
import { getEveryAppUser, type EveryAppUser } from "@every-app/sdk/server";
import { ZodError } from "zod";
import { ProjectError } from "./errors";

/**
 * Runs a JSON route for the member who called. The Gateway admits only
 * members; their user comes from the verified identity, never the request.
 */
export async function asMember(
  request: Request,
  work: (user: EveryAppUser) => Promise<Response>,
): Promise<Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return Response.json({ error: "Sign in through the Gateway." }, { status: 401 });
  try {
    return await work(user);
  } catch (error) {
    if (error instanceof ProjectError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    throw error;
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ProjectError(400, "The body must be JSON.");
  }
}
