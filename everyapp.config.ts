import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "circuit-lab",
  name: "Circuit Lab",
  description:
    "Build microcontroller circuits, write their code and run them on a simulated Uno or Pico in the browser.",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
});
