import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Diagram, Part } from "@/lib/diagram";
import type { Inputs, PartStates } from "@/client/sim/circuit";
import { physical } from "./colors";
import { bounds, partTransform, pinPoint, shape } from "./geometry";

export function CircuitCanvas({
  diagram,
  states,
  inputs,
  editable,
  selectedId,
  pendingPin,
  onSelect,
  onMove,
  onPin,
  onPress,
  onToggle,
}: {
  diagram: Diagram;
  states: PartStates;
  inputs: Inputs;
  editable: boolean;
  selectedId: string | null;
  pendingPin: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPin: (pin: string) => void;
  onPress: (id: string, pressed: boolean) => void;
  onToggle: (id: string) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const view = bounds(diagram.parts);
  const byId = new Map(diagram.parts.map((part) => [part.id, part]));

  function toSvg(event: ReactPointerEvent) {
    const matrix = svg.current!.getScreenCTM()!.inverse();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }

  function startDrag(event: ReactPointerEvent, part: Part) {
    if (!editable || event.button !== 0) return;
    const at = toSvg(event);
    setDrag({ id: part.id, dx: at.x - part.x, dy: at.y - part.y, moved: false });
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  return (
    <svg
      ref={svg}
      data-testid="canvas"
      viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
      className="h-auto w-full touch-none select-none rounded-lg border border-border bg-muted/40"
      style={{ aspectRatio: `${view.width} / ${view.height}`, maxHeight: "34rem" }}
      onPointerMove={(event) => {
        if (!drag) return;
        const at = toSvg(event);
        const x = Math.round((at.x - drag.dx) / 5) * 5;
        const y = Math.round((at.y - drag.dy) / 5) * 5;
        const part = byId.get(drag.id);
        if (part && (part.x !== x || part.y !== y)) {
          onMove(drag.id, x, y);
          if (!drag.moved) setDrag({ ...drag, moved: true });
        }
      }}
      onPointerUp={() => setDrag(null)}
      onPointerDown={(event) => {
        if (event.target === svg.current) onSelect(null);
      }}
    >
      {diagram.parts.map((part) => (
        <g
          key={part.id}
          data-testid={`part-${part.id}`}
          data-rotation={part.rotation}
          data-color={part.attrs.color}
          data-on={part.type === "led" || part.type === "buzzer" ? String(Boolean(states.on[part.id])) : undefined}
          data-channels={part.type === "rgb-led" ? (states.channels[part.id] ?? "") : undefined}
          transform={partTransform(part)}
          className={editable ? "cursor-move" : undefined}
          onPointerDown={(event) => {
            onSelect(part.id);
            startDrag(event, part);
          }}
        >
          <PartDrawing
            part={part}
            states={states}
            inputs={inputs}
            selected={selectedId === part.id}
            onPress={onPress}
            onToggle={onToggle}
          />
        </g>
      ))}
      {diagram.connections.map((wire, index) => {
        const [a, b] = [wire.from, wire.to].map((end) => {
          const [id, pin] = end.split(":");
          const part = byId.get(id!);
          return part ? pinPoint(part, pin!) : null;
        });
        if (!a || !b) return null;
        return (
          <line
            key={`${wire.from}-${wire.to}-${index}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={physical(wire.color)}
            strokeWidth={3}
            strokeLinecap="round"
            className="pointer-events-none opacity-90"
          />
        );
      })}
      {diagram.parts.map((part) =>
        Object.keys(shape(part.type).pins).map((pin) => {
          const at = pinPoint(part, pin);
          const ref = `${part.id}:${pin}`;
          return (
            <circle
              key={ref}
              data-testid={`pin-${part.id}-${pin}`}
              cx={at.x}
              cy={at.y}
              r={pendingPin === ref ? 6 : 4.5}
              className={
                pendingPin === ref
                  ? "fill-primary stroke-primary"
                  : editable
                    ? "cursor-crosshair fill-card stroke-foreground/70 hover:fill-primary"
                    : "fill-card stroke-foreground/50"
              }
              strokeWidth={1.5}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => editable && onPin(ref)}
            >
              <title>{ref}</title>
            </circle>
          );
        }),
      )}
    </svg>
  );
}

function PartDrawing({
  part,
  states,
  inputs,
  selected,
  onPress,
  onToggle,
}: {
  part: Part;
  states: PartStates;
  inputs: Inputs;
  selected: boolean;
  onPress: (id: string, pressed: boolean) => void;
  onToggle: (id: string) => void;
}) {
  const { w, h, pins } = shape(part.type);
  const outline = selected ? "stroke-primary" : "stroke-border";
  const legs = Object.values(pins).map((pin, index) => (
    <line key={index} x1={pin.x} y1={pin.y} x2={pin.x} y2={Math.min(pin.y, h * 0.6)} className="stroke-muted-foreground" strokeWidth={2} />
  ));
  switch (part.type) {
    case "uno":
    case "pico": {
      return (
        <>
          <rect width={w} height={h} rx={10} className={`fill-card ${outline}`} strokeWidth={2} />
          <rect x={w / 2 - 30} y={h / 2 - 25} width={60} height={50} rx={4} className="fill-foreground/80" />
          <text x={w / 2} y={h / 2 + 45} textAnchor="middle" className="fill-muted-foreground text-[13px] font-semibold">
            {part.type === "uno" ? "Uno · ATmega328P" : "Pico · RP2040"}
          </text>
          {Object.entries(pins).map(([pin, at]) => (
            <text
              key={pin}
              x={part.type === "uno" ? at.x : at.x < w / 2 ? at.x + 10 : at.x - 10}
              y={part.type === "uno" ? (at.y < h / 2 ? at.y + 18 : at.y - 12) : at.y + 3.5}
              textAnchor={part.type === "uno" ? "middle" : at.x < w / 2 ? "start" : "end"}
              className="pointer-events-none fill-muted-foreground text-[8px]"
              transform={part.type === "uno" ? `rotate(-90 ${at.x} ${at.y < h / 2 ? at.y + 18 : at.y - 12})` : undefined}
              dominantBaseline="middle"
            >
              {pin}
            </text>
          ))}
        </>
      );
    }
    case "led": {
      const on = states.on[part.id];
      const color = physical(part.attrs.color);
      return (
        <>
          {legs}
          {on ? <circle cx={15} cy={16} r={15} fill={color} opacity={0.35} /> : null}
          <path d="M3 30 V16 A12 12 0 0 1 27 16 V30 Z" fill={color} opacity={on ? 1 : 0.45} className={outline} strokeWidth={1.5} />
        </>
      );
    }
    case "rgb-led": {
      const lit = states.channels[part.id] ?? "";
      const glow = [["R", "red"], ["G", "green"], ["B", "blue"]].filter(([channel]) => lit.includes(channel!));
      return (
        <>
          {legs}
          <circle cx={28} cy={20} r={18} className={`fill-card ${outline}`} strokeWidth={1.5} />
          {glow.map(([channel, name], index) => (
            <circle key={channel} cx={22 + index * 6} cy={20} r={11} fill={physical(name)} opacity={0.7} />
          ))}
        </>
      );
    }
    case "resistor":
      return (
        <>
          <line x1={6} y1={12} x2={74} y2={12} className="stroke-muted-foreground" strokeWidth={2} />
          <rect x={20} y={4} width={40} height={16} rx={6} className={`fill-warning/40 ${outline}`} strokeWidth={1.5} />
          <text x={40} y={-2} textAnchor="middle" className="pointer-events-none fill-muted-foreground text-[9px]">
            {String(part.attrs.value ?? "")}Ω
          </text>
        </>
      );
    case "pushbutton": {
      const pressed = inputs.pressed[part.id];
      return (
        <>
          {legs}
          <rect x={4} y={4} width={40} height={40} rx={4} className={`fill-card ${outline}`} strokeWidth={1.5} />
          <circle
            data-testid={`press-${part.id}`}
            cx={24}
            cy={24}
            r={pressed ? 11 : 13}
            fill={physical(part.attrs.color)}
            className="cursor-pointer"
            onPointerDown={(event) => {
              event.stopPropagation();
              onPress(part.id, true);
            }}
            onPointerUp={() => onPress(part.id, false)}
            onPointerLeave={() => pressed && onPress(part.id, false)}
          />
        </>
      );
    }
    case "slide-switch": {
      const position = inputs.switches[part.id] ?? part.attrs.position;
      return (
        <>
          {legs}
          <rect x={2} y={8} width={60} height={24} rx={4} className={`fill-card ${outline}`} strokeWidth={1.5} />
          <rect
            data-testid={`toggle-${part.id}`}
            x={position === "left" ? 8 : 34}
            y={12}
            width={22}
            height={16}
            rx={3}
            className="cursor-pointer fill-foreground/70"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onToggle(part.id)}
          />
        </>
      );
    }
    case "potentiometer": {
      const value = inputs.pots[part.id] ?? Number(part.attrs.value ?? 50);
      const angle = -135 + (value / 100) * 270;
      return (
        <>
          {legs}
          <rect x={4} y={2} width={56} height={52} rx={6} className={`fill-card ${outline}`} strokeWidth={1.5} />
          <circle cx={32} cy={28} r={18} className="fill-muted stroke-muted-foreground" strokeWidth={1.5} />
          <line x1={32} y1={28} x2={32} y2={13} transform={`rotate(${angle} 32 28)`} className="stroke-foreground" strokeWidth={3} strokeLinecap="round" />
        </>
      );
    }
    case "buzzer": {
      const on = states.on[part.id];
      return (
        <>
          {legs}
          <circle cx={26} cy={24} r={20} className={`fill-foreground/80 ${outline}`} strokeWidth={1.5} />
          <circle cx={26} cy={24} r={4} className="fill-card" />
          {on ? (
            <g className="stroke-primary" fill="none" strokeWidth={2}>
              <path d="M50 12 Q56 24 50 36" />
              <path d="M2 12 Q-4 24 2 36" />
            </g>
          ) : null}
        </>
      );
    }
  }
}
