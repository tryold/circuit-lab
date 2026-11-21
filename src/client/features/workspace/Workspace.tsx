import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { DEFAULT_ATTRS, ID_PREFIX, BOARD_LABELS, type Diagram, type PartType } from "@/lib/diagram";
import type { ProjectDetail } from "@/server/projects";
import {
  copyProject,
  deleteProject,
  getFirmware,
  saveDiagram,
  updateProject,
} from "@/serverFunctions/projects";
import { CircuitCanvas } from "./CircuitCanvas";
import { DiagramToolbar, InputControls, PartInspector, WireList } from "./CircuitPanel";
import { FilesPanel, type EditableFile } from "./FilesPanel";
import { FirmwarePanel, type Firmware } from "./FirmwarePanel";
import { freeSpot, nextId } from "./geometry";
import { NameDialog } from "./NameDialog";
import { SerialMonitor, SimulationControls } from "./SimulationPanel";
import { useSimulation } from "./useSimulation";

export function Workspace({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const editable = project.isOwner;
  const [name, setName] = useState(project.name);
  const [visibility, setVisibility] = useState(project.visibility);
  const [files, setFiles] = useState<EditableFile[]>(() =>
    project.files.map((file) => ({ ...file, saved: file.content })),
  );
  const [firmware, setFirmware] = useState<Firmware>(project.firmware);
  const [diagram, setDiagramState] = useState<Diagram>(project.diagram);
  const [dirty, setDirty] = useState(false);
  const [savingDiagram, setSavingDiagram] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [wireColor, setWireColor] = useState("green");
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const sim = useSimulation(diagram);

  const setDiagram = (update: (old: Diagram) => Diagram) => {
    setDiagramState(update);
    setDirty(true);
  };
  const selected = diagram.parts.find((part) => part.id === selectedId) ?? null;

  async function run() {
    setMessage(null);
    try {
      if (project.board === "uno") {
        if (!firmware) {
          setMessage("No firmware yet. Upload an Intel HEX file to run this project.");
          return;
        }
        const hex = await getFirmware({ data: { projectId: project.id } });
        if (!hex) {
          setMessage("No firmware yet. Upload an Intel HEX file to run this project.");
          return;
        }
        const { UnoMachine } = await import("@/client/sim/avr");
        await sim.start(async (onSerial) => new UnoMachine(hex, onSerial));
      } else {
        if (!files.some((file) => file.path === "main.py")) {
          setMessage("Add a main.py file to run this project.");
          return;
        }
        const { PicoMachine } = await import("@/client/sim/pico");
        const current = files.map(({ path, content }) => ({ path, content }));
        await sim.start(async (onSerial) => new PicoMachine(current, onSerial));
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The simulation didn't start.");
    }
  }

  async function changeVisibility(shared: boolean) {
    const next = shared ? "shared" : "private";
    try {
      await updateProject({ data: { projectId: project.id, visibility: next } });
      setVisibility(next);
      toast.success(shared ? "Members can now open this project." : "Only you can open this project.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Visibility didn't change.");
    }
  }

  async function copy() {
    setBusy(true);
    try {
      const { id } = await copyProject({ data: { projectId: project.id } });
      await navigate({ to: "/p/$projectId", params: { projectId: id } });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The copy wasn't made.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSavingDiagram(true);
    try {
      await saveDiagram({ data: { projectId: project.id, diagram } });
      setDirty(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The diagram wasn't saved.");
    } finally {
      setSavingDiagram(false);
    }
  }

  function connect(pin: string) {
    if (!pendingPin) return setPendingPin(pin);
    if (pendingPin !== pin) {
      const from = pendingPin;
      setDiagram((old) => ({ ...old, connections: [...old.connections, { from, to: pin, color: wireColor as Diagram["connections"][number]["color"] }] }));
    }
    setPendingPin(null);
  }

  return (
    <AppShell
      wide
      nav={
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Projects
        </Link>
      }
    >
      <PageHeader
        title={name}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{BOARD_LABELS[project.board]}</Badge>
            <Badge data-testid="visibility-badge" variant={visibility === "shared" ? "default" : "secondary"}>
              {visibility === "shared" ? "Shared" : "Private"}
            </Badge>
            {!editable ? <span>by {project.ownerEmail}</span> : null}
            {project.copiedFrom ? <span data-testid="copied-from">Copied from {project.copiedFrom.name}</span> : null}
          </div>
        }
        actions={
          <>
            {editable ? (
              <>
                <Label className="flex items-center gap-2 font-normal">
                  <Switch
                    data-testid="visibility-toggle"
                    checked={visibility === "shared"}
                    onCheckedChange={(checked) => void changeVisibility(checked)}
                  />
                  Shared
                </Label>
                <Button variant="outline" size="sm" data-testid="rename-project" onClick={() => setDialog("rename")}>
                  <Pencil aria-hidden />
                  Rename
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" data-testid="copy-project" pending={busy} onClick={() => void copy()}>
              <Copy aria-hidden />
              Save a copy
            </Button>
            {editable ? (
              <Button variant="ghost" size="sm" data-testid="delete-project" onClick={() => setDialog("delete")}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            ) : null}
          </>
        }
      />
      {!editable ? (
        <Alert data-testid="readonly-notice">
          <AlertDescription>You can run this project but not change it. Save a copy to make it yours.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <DiagramToolbar
              board={project.board}
              diagram={diagram}
              editable={editable}
              dirty={dirty}
              saving={savingDiagram}
              wireColor={wireColor}
              onWireColor={setWireColor}
              onAdd={(type: PartType) =>
                setDiagram((old) => {
                  const id = nextId(old.parts, ID_PREFIX[type]);
                  const spot = freeSpot(old.parts, type);
                  setSelectedId(id);
                  return { ...old, parts: [...old.parts, { id, type, ...spot, rotation: 0, attrs: { ...DEFAULT_ATTRS[type] } }] };
                })
              }
              onImport={(next) => {
                setDiagram(() => next);
                setSelectedId(null);
              }}
              onSave={() => void save()}
            />
            <CircuitCanvas
              diagram={diagram}
              states={sim.states}
              inputs={sim.inputs}
              editable={editable}
              selectedId={selectedId}
              pendingPin={pendingPin}
              onSelect={setSelectedId}
              onMove={(id, x, y) =>
                setDiagram((old) => ({ ...old, parts: old.parts.map((part) => (part.id === id ? { ...part, x, y } : part)) }))
              }
              onPin={connect}
              onPress={sim.press}
              onToggle={(id) => {
                const part = diagram.parts.find((candidate) => candidate.id === id);
                sim.toggle(id, part?.attrs.position === "left" ? "left" : "right");
              }}
            />
            <InputControls diagram={diagram} pots={sim.inputs.pots} onTurn={sim.turn} />
          </section>
          <FilesPanel projectId={project.id} files={files} setFiles={setFiles} editable={editable} />
          {project.board === "uno" ? (
            <FirmwarePanel projectId={project.id} firmware={firmware} setFirmware={setFirmware} editable={editable} />
          ) : null}
        </div>
        <div className="min-w-0 space-y-6">
          <SimulationControls
            running={sim.running}
            starting={sim.starting}
            seconds={sim.seconds}
            message={message}
            onStart={() => void run()}
            onStop={sim.stop}
          />
          <SerialMonitor
            output={sim.output}
            running={sim.running}
            onClear={sim.clear}
            onSend={(line) => sim.send(project.board === "pico" ? `${line}\r` : `${line}\n`)}
          />
          {selected ? (
            <PartInspector
              part={selected}
              editable={editable}
              onClose={() => setSelectedId(null)}
              onChange={(attrs) =>
                setDiagram((old) => ({ ...old, parts: old.parts.map((part) => (part.id === selected.id ? { ...part, attrs } : part)) }))
              }
              onRotate={() =>
                setDiagram((old) => ({
                  ...old,
                  parts: old.parts.map((part) =>
                    part.id === selected.id ? { ...part, rotation: ((part.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : part,
                  ),
                }))
              }
              onDelete={() => {
                setDiagram((old) => ({
                  ...old,
                  parts: old.parts.filter((part) => part.id !== selected.id),
                  connections: old.connections.filter(
                    (wire) => !wire.from.startsWith(`${selected.id}:`) && !wire.to.startsWith(`${selected.id}:`),
                  ),
                }));
                setSelectedId(null);
              }}
            />
          ) : null}
          <WireList
            diagram={diagram}
            editable={editable}
            pendingPin={pendingPin}
            onDelete={(index) =>
              setDiagram((old) => ({ ...old, connections: old.connections.filter((_, i) => i !== index) }))
            }
          />
        </div>
      </div>

      {dialog === "rename" ? (
        <NameDialog
          title="Rename project"
          label="Name"
          initial={name}
          submitLabel="Rename"
          testId="project-name"
          onSubmit={async (next) => {
            await updateProject({ data: { projectId: project.id, name: next } });
            setName(next);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title={`Delete ${name}?`}
          confirmLabel="Delete project"
          destructive
          pending={busy}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              sim.stop();
              await deleteProject({ data: { projectId: project.id } });
              await navigate({ to: "/" });
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : "The project wasn't deleted.");
              setBusy(false);
            }
          }}
        >
          Its files, diagram and firmware are deleted too.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
