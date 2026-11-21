import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { Workspace } from "@/client/features/workspace/Workspace";
import { getProject } from "@/serverFunctions/projects";

export const Route = createFileRoute("/p/$projectId")({
  // The editor and the simulators need the browser.
  ssr: false,
  loader: ({ params }) => getProject({ data: { projectId: params.projectId } }),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.name} · Circuit Lab` : "Circuit Lab" }] }),
  component: ProjectPage,
});

function ProjectPage() {
  const project = Route.useLoaderData();
  if (!project) {
    return (
      <AppShell>
        <div data-testid="project-not-found">
          <EmptyState
            kind="error"
            title="Project not found"
            description="It was deleted, or it is private to its owner."
            action={<Button render={<Link to="/" />}>Back to projects</Button>}
          />
        </div>
      </AppShell>
    );
  }
  return <Workspace key={project.id} project={project} />;
}
