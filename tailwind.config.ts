import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#030712",
        panel: "rgba(12, 24, 46, 0.68)",
        line: "rgba(148, 163, 184, 0.22)"
      },
      boxShadow: {
        glass: "0 24px 80px rgba(0, 0, 0, 0.38)"
      }
    }
  },
  plugins: []
};

export default config;
