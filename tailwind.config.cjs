/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    fontSize : {
      xs : ["11px", "16px"],
      base : ["14px", "24px"]
    },
    extend: {
      colors : {
        "Blue" : "0C8CE9",
        "Purple" : "7B61FF",
        "Hot pink" : "F531B3",
        "Green" : "1BC47D",
        "Red" : "F24822",
        "Yellow" : "FFEB00",
        "Black" : "2C2C2C"
      }
    },
  },
  plugins: [],
}
