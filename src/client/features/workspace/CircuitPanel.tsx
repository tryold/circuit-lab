import { Download, FileDown, FileUp, Plus, RotateCw, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/client/components/CopyButton";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";
import {
  checkDiagram,
  LED_COLORS,
  PART_LABELS,
  PART_TYPES,
  WIRE_COLORS,
  type Board,
  type Diagram,
  type Part,
  type PartType,
} from "@/lib/diagram";
import { physical } from "./colors";

const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function DiagramToolbar({
  board,
  diagram,
  editable,
  dirty,
  saving,
  wireColor,
  onWireColor,
  onAdd,
  onImport,
  onSave,
}: {
  board: Board;
  diagram: Diagram;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  wireColor: string;
  onWireColor: (color: string) => void;
  onAdd: (type: PartType) => void;
  onImport: (diagram: Diagram) => void;
  onSave: () => void;
}) {
  const [dialog, setDialog] = useState<"import" | "export" | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {editable ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid="add-part" />}>
              <Plus aria-hidden />
              Add part
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PART_TYPES.map((type) => (
                <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
                  {PART_LABELS[type]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select
            items={WIRE_COLORS.map((color) => ({ value: color, label: title(color) }))}
            value={wireColor}
            onValueChange={(value) => value && onWireColor(value)}
          >
            <SelectTrigger size="sm" aria-label="Wire colour" className="w-32">
              <span className="size-3 rounded-full" style={{ background: physical(wireColor) }} aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIRE_COLORS.map((color) => (
                <SelectItem key={color} value={color}>
                  {title(color)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" data-testid="diagram-import" onClick={() => setDialog("import")}>
            <FileUp aria-hidden />
            Import
          </Button>
        </>
      ) : null}
      <Button variant="ghost" size="sm" data-testid="diagram-export" onClick={() => setDialog("export")}>
        <FileDown aria-hidden />
        Export
      </Button>
      {editable ? (
        <div className="ml-auto flex items-center gap-3">
          <span data-testid="diagram-status" className="text-sm text-muted-foreground">
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <Button size="sm" data-testid="diagram-save" pending={saving} disabled={!dirty} onClick={onSave}>
            <Save aria-hidden />
            Save
          </Button>
        </div>
      ) : null}
      {dialog === "export" ? <ExportDialog diagram={diagram} onClose={() => setDialog(null)} /> : null}
      {dialog === "import" ? (
        <ImportDialog
          board={board}
          onImport={(next) => {
            onImport(next);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function ExportDialog({ diagram, onClose }: { diagram: Diagram; onClose: () => void }) {
  const json = JSON.stringify(diagram, null, 2);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Diagram JSON</DialogTitle>
        </DialogHeader>
        <pre data-testid="diagram-export-json" className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {json}
        </pre>
        <DialogFooter>
          <CopyButton value={json} successMessage="Copied the diagram." />
          <Button
            variant="outline"
            render={<a href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`} download="diagram.json" />}
          >
            <Download aria-hidden />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  board,
  onImport,
  onClose,
}: {
  board: Board;
  onImport: (diagram: Diagram) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            let parsed: unknown;
            try {
              parsed = JSON.parse(text);
            } catch {
              setError("That isn't JSON.");
              return;
            }
            const checked = checkDiagram(parsed, board);
            if (checked.ok) onImport(checked.diagram);
            else setError(checked.error);
          }}
        >
          <DialogHeader>
            <DialogTitle>Import a diagram</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="diagram-json">Diagram JSON</Label>
            <Textarea
              id="diagram-json"
              data-testid="diagram-json"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="h-64 font-mono text-xs"
            />
            <p className="text-sm text-muted-foreground">Replaces the current diagram.</p>
          </div>
          {error ? (
            <Alert variant="destructive" data-testid="diagram-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="diagram-import-submit" disabled={!text.trim()}>
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PartInspector({
  part,
  editable,
  onChange,
  onRotate,
  onDelete,
  onClose,
}: {
  part: Part;
  editable: boolean;
  onChange: (attrs: Part["attrs"]) => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const isBoard = part.id === "board";
  const colorItems = LED_COLORS.map((color) => ({ value: color, label: title(color) }));
  return (
    <section data-testid="part-inspector" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">
          {part.id} <span className="text-muted-foreground">· {isBoard ? "Board" : PART_LABELS[part.type as PartType]}</span>
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>
      {(part.type === "led" || part.type === "pushbutton") && (
        <div className="space-y-1.5">
          <Label>Colour</Label>
          <Select
            items={colorItems}
            value={String(part.attrs.color ?? "red")}
            disabled={!editable}
            onValueChange={(value) => value && onChange({ ...part.attrs, color: value })}
          >
            <SelectTrigger data-testid="part-attr-color" aria-label="Colour" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {colorItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {part.type === "resistor" && (
        <div className="space-y-1.5">
          <Label htmlFor="part-attr-value">Resistance (Ω)</Label>
          <Input
            id="part-attr-value"
            data-testid="part-attr-value"
            value={String(part.attrs.value ?? "")}
            disabled={!editable}
            maxLength={12}
            onChange={(event) => onChange({ ...part.attrs, value: event.target.value })}
          />
        </div>
      )}
      {part.type === "potentiometer" && (
        <div className="space-y-1.5">
          <Label htmlFor="part-attr-start">Starting position (%)</Label>
          <Input
            id="part-attr-start"
            type="number"
            min={0}
            max={100}
            value={Number(part.attrs.value ?? 50)}
            disabled={!editable}
            onChange={(event) => onChange({ ...part.attrs, value: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
        </div>
      )}
      {editable && !isBoard ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="rotate-part" onClick={onRotate}>
            <RotateCw aria-hidden />
            Rotate
          </Button>
          <Button variant="outline" size="sm" data-testid="delete-part" onClick={onDelete}>
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function WireList({
  diagram,
  editable,
  pendingPin,
  onDelete,
}: {
  diagram: Diagram;
  editable: boolean;
  pendingPin: string | null;
  onDelete: (index: number) => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4">
      <h2 className="font-medium">Wires</h2>
      {pendingPin ? (
        <p className="text-sm text-muted-foreground">From {pendingPin}: pick the other pin.</p>
      ) : null}
      {diagram.connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {editable ? "None yet. Click a pin, then another, to connect them." : "None."}
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm" data-testid="wire-list">
          {diagram.connections.map((wire, index) => (
            <li key={`${wire.from}-${wire.to}-${index}`} data-testid="wire-row" className="flex items-center gap-2 py-1.5">
              <span className="size-3 shrink-0 rounded-full" style={{ background: physical(wire.color) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {wire.from} → {wire.to}
              </span>
              {editable ? (
                <Button variant="ghost" size="icon-xs" data-testid="delete-wire" aria-label={`Delete wire ${wire.from} to ${wire.to}`} onClick={() => onDelete(index)}>
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InputControls({
  diagram,
  pots,
  onTurn,
}: {
  diagram: Diagram;
  pots: Record<string, number>;
  onTurn: (id: string, value: number) => void;
}) {
  const knobs = diagram.parts.filter((part) => part.type === "potentiometer");
  if (knobs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {knobs.map((part) => {
        const value = pots[part.id] ?? Number(part.attrs.value ?? 50);
        return (
          <label key={part.id} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs">{part.id}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              data-testid={`pot-slider-${part.id}`}
              onChange={(event) => onTurn(part.id, Number(event.target.value))}
              className="accent-primary"
            />
            <span className="w-10 text-muted-foreground tabular-nums">{value}%</span>
          </label>
        );
      })}
    </div>
  );
}
