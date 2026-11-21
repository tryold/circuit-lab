import { Cpu, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { formatBytes, timeAgo } from "@/client/features/projects/format";
import { parseIntelHex } from "@/lib/intelHex";
import { removeFirmware, uploadFirmware } from "@/serverFunctions/projects";

export type Firmware = { size: number; uploadedAt: string } | null;

export function FirmwarePanel({
  projectId,
  firmware,
  setFirmware,
  editable,
}: {
  projectId: string;
  firmware: Firmware;
  setFirmware: (firmware: Firmware) => void;
  editable: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function upload(file: File) {
    setError(null);
    setPending(true);
    try {
      const hex = await file.text();
      parseIntelHex(hex);
      setFirmware(await uploadFirmware({ data: { projectId, hex } }));
    } catch (cause) {
      setError(`${file.name}: ${cause instanceof Error ? cause.message : "not a HEX file."}`);
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Cpu className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-medium">Firmware</h2>
            {firmware ? (
              <p data-testid="firmware-info" className="text-sm text-muted-foreground">
                {formatBytes(firmware.size)} · uploaded{" "}
                <time dateTime={firmware.uploadedAt}>{timeAgo(firmware.uploadedAt)}</time>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">None. Upload an Intel HEX file to run this project.</p>
            )}
          </div>
        </div>
        {editable ? (
          <div className="flex items-center gap-2">
            {firmware ? (
              <Button variant="ghost" size="sm" data-testid="remove-firmware" onClick={() => setConfirming(true)}>
                Remove
              </Button>
            ) : null}
            <Button variant="outline" size="sm" pending={pending} onClick={() => input.current?.click()}>
              <Upload aria-hidden />
              Upload HEX
            </Button>
            <input
              ref={input}
              type="file"
              accept=".hex,.ihx,text/plain"
              className="sr-only"
              data-testid="firmware-input"
              aria-label="Firmware file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive" data-testid="firmware-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="Remove the firmware?"
          confirmLabel="Remove firmware"
          destructive
          pending={pending}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setPending(true);
            try {
              await removeFirmware({ data: { projectId } });
              setFirmware(null);
              setConfirming(false);
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : "The firmware wasn't removed.");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </section>
  );
}
