/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        bg: "var(--color-bg)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
