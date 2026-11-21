import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { NewProjectDialog } from "@/client/features/projects/NewProjectDialog";
import { timeAgo } from "@/client/features/projects/format";
import { BOARD_LABELS, type Board } from "@/lib/diagram";
import { deleteProject, getProjectLists } from "@/serverFunctions/projects";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ tab: z.enum(["mine", "shared"]).optional() }),
  loader: () => getProjectLists(),
  head: () => ({ meta: [{ title: "Circuit Lab" }] }),
  component: ProjectsPage,
});

type SortKey = "name" | "board" | "visibility" | "updatedAt";
interface Row {
  id: string;
  name: string;
  board: Board;
  visibility: "private" | "shared";
  updatedAt: string;
  ownerEmail?: string;
  canRemove?: boolean;
}

function ProjectsPage() {
  const { mine, shared } = Route.useLoaderData();
  const { tab = "mine" } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <AppShell>
      <PageHeader
        title="Projects"
        actions={
          <Button data-testid="new-project" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New project
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onValueChange={(value) => void navigate({ search: { tab: value === "shared" ? "shared" : undefined } })}
          >
            <TabsList>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="shared">Shared</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              data-testid="project-search"
              aria-label="Search projects"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="bg-card pl-9"
            />
          </div>
        </div>
        {tab === "mine" ? (
          <ProjectTable
            rows={mine as Row[]}
            query={query}
            kind="mine"
            empty={
              <EmptyState
                title="No projects yet"
                description="Create one and it will appear here."
                action={<Button onClick={() => setCreating(true)}>New project</Button>}
              />
            }
          />
        ) : (
          <ProjectTable
            rows={shared as Row[]}
            query={query}
            kind="shared"
            empty={<EmptyState title="Nothing shared yet" description="Projects members share appear here." />}
          />
        )}
      </div>
      {creating ? <NewProjectDialog onClose={() => setCreating(false)} /> : null}
    </AppShell>
  );
}

function ProjectTable({
  rows,
  query,
  kind,
  empty,
}: {
  rows: Row[];
  query: string;
  kind: "mine" | "shared";
  empty: React.ReactNode;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "updatedAt", desc: true });
  const [removing, setRemoving] = useState<Row | null>(null);
  const [pending, setPending] = useState(false);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter(
      (row) =>
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        (row.ownerEmail ?? "").toLowerCase().includes(needle),
    );
    return filtered.sort((a, b) => {
      const order = String(a[sort.key]).localeCompare(String(b[sort.key]), "en", { sensitivity: "base" });
      return sort.desc ? -order : order;
    });
  }, [rows, query, sort]);

  if (rows.length === 0) return <div data-testid={kind === "mine" ? "projects-empty" : "shared-empty"}>{empty}</div>;

  const header = (key: SortKey, label: string) => {
    const Icon = sort.key !== key ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
    return (
      <TableHead>
        <button
          type="button"
          data-testid={`sort-${key === "updatedAt" ? "updated" : key}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => setSort((current) => ({ key, desc: current.key === key ? !current.desc : key === "updatedAt" }))}
        >
          {label}
          <Icon className="size-3.5" aria-hidden />
        </button>
      </TableHead>
    );
  };

  async function remove(row: Row) {
    setPending(true);
    try {
      await deleteProject({ data: { projectId: row.id } });
      toast.success(`Removed ${row.name}`);
      setRemoving(null);
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The project wasn't removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              {header("name", "Name")}
              {header("board", "Board")}
              {kind === "mine" ? header("visibility", "Visibility") : <TableHead>Owner</TableHead>}
              {header("updatedAt", "Updated")}
              {kind === "shared" ? <TableHead className="w-0" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No projects match “{query}”.
                </TableCell>
              </TableRow>
            ) : (
              shown.map((row) => (
                <TableRow key={row.id} data-testid={kind === "mine" ? "project-row" : "shared-row"}>
                  <TableCell className="font-medium">
                    <Link to="/p/$projectId" params={{ projectId: row.id }} className="hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{BOARD_LABELS[row.board]}</TableCell>
                  <TableCell>
                    {kind === "mine" ? (
                      <Badge variant={row.visibility === "shared" ? "default" : "secondary"}>
                        {row.visibility === "shared" ? "Shared" : "Private"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{row.ownerEmail}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <time dateTime={row.updatedAt} suppressHydrationWarning>
                      {timeAgo(row.updatedAt)}
                    </time>
                  </TableCell>
                  {kind === "shared" ? (
                    <TableCell className="text-right">
                      {row.canRemove ? (
                        <Button variant="ghost" size="sm" data-testid="remove-shared" onClick={() => setRemoving(row)}>
                          Remove
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableCard>
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          confirmLabel="Remove project"
          destructive
          pending={pending}
          onConfirm={() => void remove(removing)}
          onClose={() => setRemoving(null)}
        >
          The project and its files are deleted for everyone, its owner included.
        </ConfirmDialog>
      ) : null}
    </>
  );
}
