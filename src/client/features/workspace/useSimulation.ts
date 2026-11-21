import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE, settle, type Inputs, type PartStates } from "@/client/sim/circuit";
import type { Machine } from "@/client/sim/machine";
import type { Diagram } from "@/lib/diagram";

const MAX_OUTPUT = 20_000;

/** Runs one machine at a time against the live diagram and inputs. */
export function useSimulation(diagram: Diagram) {
  const machine = useRef<Machine | null>(null);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const [inputs, setInputs] = useState<Inputs>({ pressed: {}, switches: {}, pots: {} });
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [states, setStates] = useState<PartStates>(IDLE);
  const [seconds, setSeconds] = useState(0);
  const [output, setOutput] = useState("");
  const pending = useRef("");

  const append = useCallback((text: string) => {
    pending.current += text.replace(/\r/g, "");
  }, []);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = "";
    const tick = () => {
      const current = machine.current;
      if (current) {
        const next = settle(diagramRef.current, current, inputsRef.current, performance.now());
        const key = JSON.stringify(next);
        if (key !== last) {
          last = key;
          setStates(next);
        }
        setSeconds(current.seconds());
      }
      if (pending.current) {
        const text = pending.current;
        pending.current = "";
        setOutput((old) => (old + text).slice(-MAX_OUTPUT));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const stop = useCallback(() => {
    machine.current?.stop();
    machine.current = null;
    setRunning(false);
    setStates(IDLE);
    setInputs((old) => ({ ...old, pressed: {} }));
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (make: (onSerial: (text: string) => void) => Promise<Machine>) => {
      stop();
      setStarting(true);
      setOutput("");
      pending.current = "";
      setSeconds(0);
      try {
        const next = await make(append);
        machine.current = next;
        await next.start();
        setRunning(true);
      } finally {
        setStarting(false);
      }
    },
    [append, stop],
  );

  return {
    running,
    starting,
    states,
    seconds,
    output,
    inputs,
    start,
    stop,
    clear: () => setOutput(""),
    send: (text: string) => machine.current?.sendSerial(text),
    press: (id: string, pressed: boolean) =>
      setInputs((old) => ({ ...old, pressed: { ...old.pressed, [id]: pressed } })),
    toggle: (id: string, from: "left" | "right") =>
      setInputs((old) => ({
        ...old,
        switches: { ...old.switches, [id]: (old.switches[id] ?? from) === "left" ? "right" : "left" },
      })),
    turn: (id: string, value: number) =>
      setInputs((old) => ({ ...old, pots: { ...old.pots, [id]: value } })),
  };
}
