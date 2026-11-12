import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/** Avito portal palette: base, interaction states, soft fills and readable text tones. */
const portalColors = {
  blue: { DEFAULT: "#00aaff", hover: "#0099f7", pressed: "#008aed", soft: "#cfedff", "soft-hover": "#a1dfff", text: "#008aed" },
  green: { DEFAULT: "#02d15c", hover: "#00c257", pressed: "#00b253", soft: "#d2fcc4", "soft-hover": "#c8efba", text: "#00b253" },
  red: { DEFAULT: "#ff4053", soft: "#ffe0e0", "soft-hover": "#f2d5d5", text: "#ff4053" },
  purple: { DEFAULT: "#965eeb", hover: "#8c4fe8", pressed: "#8144db", soft: "#e9ddfd", text: "#8c4fe8" },
  orange: { DEFAULT: "#f79900", soft: "#ffecc9", text: "#f79900" },
  dark: { DEFAULT: "#141414", hover: "#1f1f1f" },
  link: { DEFAULT: "#0099f7", hover: "#ff4053" },
  primary: "#000000",
  secondary: "#757575",
  tertiary: "#a3a3a3",
  fill: { DEFAULT: "rgba(0, 0, 0, 0.04)", hover: "rgba(0, 0, 0, 0.08)", strong: "rgba(0, 0, 0, 0.1)" },
  control: { DEFAULT: "#f2f1f0", hover: "#ebeae8", pressed: "#e3e2e1" },
  "white-pressed": "#f7f7f5",
  divider: { DEFAULT: "#ebeae8", hover: "#dbdbd9" },
  focus: "#45c1ff",
  // Card tone set by a palette-* utility on the element or one of its parents.
  tone: { DEFAULT: "var(--tone)", fg: "var(--tone-fg)", soft: "var(--tone-soft)", text: "var(--tone-text)" },
};

/** Pixel companion workspace colours. */
const buddyColors = {
  ink: "#25252b",
  canvas: "#f7f8fa",
  line: "#e9e9ef",
  muted: "#81818c",
  lilac: "#7760c4",
  // Colours of the pet on screen, set inline from its palette.
  pet: { DEFAULT: "var(--pet-color)", bg: "var(--pet-bg)" },
};

const palettes = {
  blue: { bg: "#00aaff", soft: "#cfedff", text: "#008aed" },
  green: { bg: "#02d15c", soft: "#d2fcc4", text: "#00b253" },
  red: { bg: "#ff4053", soft: "#ffe0e0", text: "#ff4053" },
  purple: { bg: "#965eeb", soft: "#e9ddfd", text: "#8c4fe8" },
  dark: { bg: "#141414", soft: "#f2f1f0", text: "#000000" },
};

const pxScale = (from: number, to: number) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [String(from + i), `${from + i}px`]));

export default {
  plugins: [plugin(({ addBase, addUtilities, addVariant }) => {
    // Hover styles apply on touch screens too, as in the original stylesheet.
    addVariant("hover", "&:hover");
    for (const width of [1100, 1000, 900, 720]) {
      addVariant(`hub-max-${width}`, `@media (max-width: ${width}px)`);
    }
    addUtilities(Object.fromEntries(Object.entries(palettes).map(([name, tone]) => [`.palette-${name}`, {
      "--tone": tone.bg, "--tone-fg": "#ffffff", "--tone-soft": tone.soft, "--tone-text": tone.text,
    }])));
    addUtilities({ ".scrollbar-none": { "scrollbar-width": "none", "&::-webkit-scrollbar": { display: "none" } } });
    addBase({
      body: { "font-synthesis": "none", "text-rendering": "optimizeLegibility" },
      ":where(button, a)": { "touch-action": "manipulation", "-webkit-tap-highlight-color": "transparent" },
      ":where(button)": { cursor: "pointer" },
      ":where(button:disabled)": { cursor: "default" },
      "body :where(button, a):focus-visible": { outline: "3px solid #a28bdd", "outline-offset": "4px" },
      ":where(button, a) svg": { "flex-shrink": "0" },
      svg: { "vertical-align": "middle" },
      "@media (prefers-reduced-motion: reduce)": {
        "body *": { animation: "none !important", transition: "none !important", "scroll-behavior": "auto !important" },
      },
    });
  })],
  "theme": {
    "screens": {
      "xs": "361px",
      "sm": "651px",
      "md": "851px",
      "lg": "1201px",
      "xl": "1600px"
    },
    "extend": {
      colors: { ...portalColors, ...buddyColors },
      // Pixel sizes from the Avito and companion layouts: text-13 is 13px.
      fontSize: pxScale(7, 42),
      boxShadow: {
        float: "0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 30px rgba(0, 0, 0, 0.1)",
        pop: "0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05)",
      },
      transitionTimingFunction: { button: "cubic-bezier(0.5, 0, 0.25, 1)" },
      "fontFamily": {
        "pixel": [
          "var(--font-pixel)",
          "monospace"
        ],
        "sans": [
          "var(--font-golos)",
          "sans-serif"
        ],
        portal: ["var(--font-portal)", "Arial", "Helvetica", "sans-serif"],
      },
      "keyframes": {
"hub-home-slideIn": {"from":{"opacity":"0"}},
"hub-ui-shimmer": {"from":{"backgroundPosition":"200% 0"},"to":{"backgroundPosition":"-200% 0"}},
"hub-ui-fade": {"from":{"opacity":"0"}},
"hub-ui-rise": {"from":{"opacity":"0","transform":"translateY(12px)"}},
"hub-layout-drop": {"from":{"opacity":"0","transform":"translateY(-6px)"}},
"hub-layout-lift": {"to":{"opacity":"0","transform":"translateY(-6px)"}},
        "sprite-frame": {
          "0%,\n  24.999%": {
            "opacity": "1"
          },
          "25%,\n  100%": {
            "opacity": "0"
          }
        },
        "companion-talk": {
          "50%": {
            "transform": "translateY(-2px)"
          }
        },
        "dialogue-open": {
          "from": {
            "opacity": "0"
          },
          "to": {
            "opacity": "1"
          }
        },
        "dialogue-cursor": {
          "50%": {
            "opacity": "0"
          }
        },
        "appear": {
          "from": {
            "opacity": "0"
          },
          "to": {
            "opacity": "1"
          }
        }
      },
      "animation": {
"hub-home-slideIn": "hub-home-slideIn 0.2s ease-out",
"hub-ui-shimmer": "hub-ui-shimmer 1.2s ease-in-out infinite",
"hub-ui-fade": "hub-ui-fade 0.15s ease-out",
"hub-ui-rise": "hub-ui-rise 0.18s ease-out",
"hub-layout-drop": "hub-layout-drop 0.2s ease-out",
"hub-layout-lift": "hub-layout-lift 0.15s ease-in forwards",
        "sprite-frame": "sprite-frame 3.2s steps(1, end) infinite",
        "dialogue-open": "dialogue-open 120ms steps(2, end)",
        "dialogue-cursor": "dialogue-cursor 800ms steps(1) infinite",
        "companion-talk": "companion-talk 200ms steps(2, end) infinite",
        "appear": "appear 0.25s ease-out"
      }
    }
  }
} satisfies Config;
