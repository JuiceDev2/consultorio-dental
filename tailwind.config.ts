import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#132322",
        paper: "#F5F7F6",
        teal: {
          50: "#EAF4F2",
          100: "#CFE6E2",
          300: "#7FBDB4",
          500: "#1F7A70",
          600: "#166059",
          700: "#0F4844",
        },
        gold: {
          400: "#E5B567",
          500: "#D69C41",
        },
        line: "#DCE3E1",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
