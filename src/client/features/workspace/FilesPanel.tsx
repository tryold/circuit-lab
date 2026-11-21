import { FilePlus, Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { addFile, deleteFile, renameFile, saveFile } from "@/serverFunctions/projects";
import { CodeEditor } from "./CodeEditor";
import { NameDialog } from "./NameDialog";

export interface EditableFile {
  path: string;
  content: string;
  saved: string;
}

export function FilesPanel({
  projectId,
  files,
  setFiles,
  editable,
}: {
  projectId: string;
  files: EditableFile[];
  setFiles: (update: (files: EditableFile[]) => EditableFile[]) => void;
  editable: boolean;
}) {
  const [active, setActive] = useState<string | null>(files[0]?.path ?? null);
  const [dialog, setDialog] = useState<"add" | "rename" | "delete" | null>(null);
  const [saving, setSaving] = useState(false);
  const current = files.find((file) => file.path === active) ?? files[0] ?? null;

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      await saveFile({ data: { projectId, path: current.path, content: current.content } });
      setFiles((all) => all.map((file) => (file.path === current.path ? { ...file, saved: current.content } : file)));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The file wasn't saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Files">
          {files.map((file) => (
            <Button
              key={file.path}
              role="tab"
              aria-selected={file.path === current?.path}
              data-testid={`file-tab-${file.path}`}
              variant={file.path === current?.path ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActive(file.path)}
            >
              {file.path}
              {file.content !== file.saved ? <span aria-label="unsaved">•</span> : null}
            </Button>
          ))}
        </div>
        {editable ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" data-testid="add-file" onClick={() => setDialog("add")}>
              <FilePlus aria-hidden />
              New file
            </Button>
            {current ? (
              <>
                <Button variant="ghost" size="icon-sm" data-testid="rename-file" aria-label="Rename" onClick={() => setDialog("rename")}>
                  <Pencil aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" data-testid="delete-file" aria-label="Delete" onClick={() => setDialog("delete")}>
                  <Trash2 aria-hidden />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {current ? (
        <>
          <CodeEditor
            key={current.path}
            path={current.path}
            value={current.content}
            readOnly={!editable}
            onChange={(content) =>
              setFiles((all) => all.map((file) => (file.path === current.path ? { ...file, content } : file)))
            }
          />
          {editable ? (
            <div className="flex items-center justify-end gap-3">
              <span data-testid="file-status" className="text-sm text-muted-foreground">
                {current.content === current.saved ? "Saved" : "Unsaved changes"}
              </span>
              <Button size="sm" data-testid="save-file" pending={saving} disabled={current.content === current.saved} onClick={() => void save()}>
                <Save aria-hidden />
                Save
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No files.</p>
      )}

      {dialog === "add" ? (
        <NameDialogFor
          title="New file"
          submitLabel="Add"
          onSubmit={async (path) => {
            await addFile({ data: { projectId, path, content: "" } });
            setFiles((all) => [...all, { path, content: "", saved: "" }]);
            setActive(path);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "rename" && current ? (
        <NameDialogFor
          title={`Rename ${current.path}`}
          initial={current.path}
          submitLabel="Rename"
          onSubmit={async (newPath) => {
            await renameFile({ data: { projectId, path: current.path, newPath } });
            setFiles((all) => all.map((file) => (file.path === current.path ? { ...file, path: newPath } : file)));
            setActive(newPath);
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "delete" && current ? (
        <ConfirmDialog
          title={`Delete ${current.path}?`}
          confirmLabel="Delete file"
          destructive
          pending={saving}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setSaving(true);
            try {
              await deleteFile({ data: { projectId, path: current.path } });
              setFiles((all) => all.filter((file) => file.path !== current.path));
              setActive(null);
              setDialog(null);
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : "The file wasn't deleted.");
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function NameDialogFor(props: {
  title: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  return <NameDialog {...props} label="File name" testId="file-name" />;
}

