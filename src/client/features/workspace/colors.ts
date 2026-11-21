// What a coloured LED, cap or wire looks like, taken from the app's tokens.
const mix = (a: string, b: string) => `color-mix(in oklch, var(${a}), var(${b}))`;

const PHYSICAL: Record<string, string> = {
  red: "var(--destructive)",
  green: "var(--success)",
  blue: "var(--info)",
  yellow: "var(--warning)",
  orange: mix("--destructive", "--warning"),
  purple: mix("--destructive", "--info"),
  white: "var(--background)",
  black: "var(--foreground)",
};

export const physical = (name: unknown) => PHYSICAL[String(name)] ?? "var(--muted-foreground)";
