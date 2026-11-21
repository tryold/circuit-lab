import { Eraser, Play, RotateCcw, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";

export function SimulationControls({
  running,
  starting,
  seconds,
  message,
  onStart,
  onStop,
}: {
  running: boolean;
  starting: boolean;
  seconds: number;
  message: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {running ? (
            <>
              <Button data-testid="sim-stop" variant="destructive" onClick={onStop}>
                <Square aria-hidden />
                Stop
              </Button>
              <Button data-testid="sim-restart" variant="outline" onClick={onStart}>
                <RotateCcw aria-hidden />
                Restart
              </Button>
            </>
          ) : (
            <Button data-testid="sim-start" pending={starting} onClick={onStart}>
              <Play aria-hidden />
              Run
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="sr-only">Simulated time </span>
          <span data-testid="sim-time">{seconds.toFixed(3)} s</span>
        </p>
      </div>
      {message ? (
        <Alert data-testid="sim-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

export function SerialMonitor({
  output,
  running,
  onSend,
  onClear,
}: {
  output: string;
  running: boolean;
  onSend: (line: string) => void;
  onClear: () => void;
}) {
  const [line, setLine] = useState("");
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [output]);
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Serial monitor</h2>
        <Button variant="ghost" size="sm" data-testid="serial-clear" onClick={onClear}>
          <Eraser aria-hidden />
          Clear
        </Button>
      </div>
      <pre
        ref={box}
        data-testid="serial-output"
        aria-live="polite"
        className="h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap"
      >{output}</pre>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend(line);
          setLine("");
        }}
      >
        <Input
          data-testid="serial-input"
          aria-label="Send to the program"
          placeholder={running ? "Type a line and press Enter" : "Run the project to send input"}
          value={line}
          disabled={!running}
          onChange={(event) => setLine(event.target.value)}
          className="font-mono"
        />
        <Button type="submit" variant="outline" data-testid="serial-send" disabled={!running}>
          <Send aria-hidden />
          Send
        </Button>
      </form>
    </section>
  );
}
