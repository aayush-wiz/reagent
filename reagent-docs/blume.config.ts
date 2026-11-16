import { defineConfig } from "blume";

/**
 * Reagent — Research Algorithms documentation, powered by Blume.
 * Branding matches the app: warm off-white / near-black grounds, sage-green accent.
 */
export default defineConfig({
  title: "Reagent",
  description:
    "The algorithms behind Reagent's iterative Strong-Inference research loop — ranking, experiment selection, hypothesis breeding, search, and literature discovery, with formulas.",
  logo: "/logo.svg",
  theme: {
    // Reagent's sage green — deep on light, brightened for the dark ground.
    accent: { light: "#3F7355", dark: "#6DB183" },
    background: { light: "#F7F6F4", dark: "#15140F" },
    mode: "system",
    radius: "md",
  },
  toc: true,
  feedback: false,
});
