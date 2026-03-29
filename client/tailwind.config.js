/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slateNight: "#0f172a",
        sunrise: "#ef4444",
        warmGold: "#f59e0b",
      },
      boxShadow: {
        glow: "0 20px 60px -30px rgba(239, 68, 68, 0.65)",
      },
    },
  },
  plugins: [],
};
