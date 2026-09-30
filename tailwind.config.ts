/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EFF4FF",
          100: "#DCE7FD",
          200: "#C0D4FC",
          300: "#94B8FA",
          400: "#6191F7",
          500: "#3D6BF2",
          600: "#1D4ED8",
          700: "#1E40AF",
          800: "#1E3A8A",
          900: "#172E6E",
        },
        // Amber accent scale for the ScholarSuite design language.
        // Anchored at 500 = #f0a020; used for the logo mark, active
        // states, icons, highlights, and the amber end of CTA gradients.
        accent: {
          50: "#FEF9EC",
          100: "#FDF0D3",
          200: "#FAE3A8",
          300: "#F7CF6B",
          400: "#F4B93E",
          500: "#F0A020",
          600: "#C98712",
          700: "#A66D0E",
          800: "#85570F",
          900: "#6E4710",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.05)",
      },
    },
  },
  plugins: [],
};
