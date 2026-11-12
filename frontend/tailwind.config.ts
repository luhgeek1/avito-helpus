import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  plugins: [plugin(({ addVariant }) => {
    for (const width of [1100, 1000, 900, 720]) {
      addVariant(`hub-max-${width}`, `@media (max-width: ${width}px)`);
    }
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
      "fontFamily": {
        "pixel": [
          "var(--font-pixel)",
          "monospace"
        ],
        "sans": [
          "var(--font-golos)",
          "sans-serif"
        ]
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
