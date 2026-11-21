/** A refusal the caller may see, with the HTTP status a JSON route answers. */
export class ProjectError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

export const notFound = () => new ProjectError(404, "Project not found.");
export const ownerOnly = () =>
  new ProjectError(403, "Only the project's owner can change it.");
