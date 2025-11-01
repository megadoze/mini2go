/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // screens: {
    //   sm: "425px",
    // },
    extend: {
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
      colors: {
        perecRed: "#e3120b",
      },
      fontFamily: {
        openSans: ["OpenSans", "sans-serif"],
        ptSans: ["PTSansNarrow", "sans-serif"],
        roboto: ["Roboto", "sans-serif"],
        robotoCondensed: ["RobotoCondensed", "sans-serif"],
      },
    },
  },
  plugins: [],
};
