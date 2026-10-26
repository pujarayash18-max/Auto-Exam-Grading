import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-subtle": "var(--text-subtle)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          text: "var(--primary-text)",
        },
        success: {
          bg: "var(--success-bg)",
          text: "var(--success-text)",
        },
        info: {
          bg: "var(--info-bg)",
          text: "var(--info-text)",
        },
        warning: {
          bg: "var(--warning-bg)",
          text: "var(--warning-text)",
        },
        danger: {
          bg: "var(--danger-bg)",
          text: "var(--danger-text)",
        },
        // Compatibility mappings
        background: "var(--bg)",
        foreground: "var(--text)",
        card: "var(--surface)",
        "card-foreground": "var(--text)",
        muted: "var(--surface-muted)",
        "muted-foreground": "var(--text-muted)",
        accent: "var(--surface-muted)",
        "accent-foreground": "var(--primary)",
        destructive: "var(--danger-text)",
        "destructive-foreground": "#FFFFFF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        lg: "8px",
        xl: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
