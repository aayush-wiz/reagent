import { defineComponents } from "blume";

export default defineComponents({
  layout: {
    // Renders on every page; used purely to inject the site-wide Geist Pixel
    // typeface (see components/brand-font.astro). No visible footer content.
    Footer: "./components/brand-font.astro",
  },
});
