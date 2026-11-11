import type { Config } from "tailwindcss";

export default {
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
        "sprite-frame": "sprite-frame 3.2s steps(1, end) infinite",
        "dialogue-open": "dialogue-open 120ms steps(2, end)",
        "dialogue-cursor": "dialogue-cursor 800ms steps(1) infinite",
        "companion-talk": "companion-talk 200ms steps(2, end) infinite",
        "appear": "appear 0.25s ease-out"
      }
    }
  }
} satisfies Config;
