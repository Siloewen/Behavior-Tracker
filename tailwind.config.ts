import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#0a0a0a",
          elevated: "#141414",
          card: "#1c1c1c",
        },
        accent: {
          DEFAULT: "#7c6af7",
          dim: "#5a4fd4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
