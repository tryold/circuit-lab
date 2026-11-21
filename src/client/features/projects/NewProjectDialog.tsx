import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import type { Board } from "@/lib/diagram";
import { createProject } from "@/serverFunctions/projects";

const BOARD_CHOICES: { value: Board; label: string; detail: string }[] = [
  { value: "uno", label: "Uno (ATmega328P)", detail: "Runs Intel HEX firmware you upload" },
  { value: "pico", label: "Pico (RP2040)", detail: "Runs MicroPython" },
];

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [board, setBoard] = useState<Board>("uno");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const { id } = await createProject({ data: { name, board } });
      await navigate({ to: "/p/$projectId", params: { projectId: id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The project wasn't created.");
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              data-testid="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Board</Label>
            <RadioGroup value={board} onValueChange={(value) => setBoard(value as Board)}>
              {BOARD_CHOICES.map((choice) => (
                <Label
                  key={choice.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 font-normal"
                >
                  <RadioGroupItem value={choice.value} aria-label={choice.label} className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{choice.label}</span>
                    <span className="block text-sm text-muted-foreground">{choice.detail}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" data-testid="create-project" pending={pending} disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
