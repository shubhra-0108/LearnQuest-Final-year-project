/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        cosmicLight: '#F4F7FC',     // Bright starship clean base background
        cosmicCard: 'rgba(255, 255, 255, 0.75)', // Ultra-premium frosted ice glass
        solarAmber: '#FF9F1C',     // Energetic sun yellow
        electricBlue: '#3A86FF',   // High-tech navigation blue
        auroraMint: '#2EC4B6',     // Friendly neon teal/green for success paths
        cosmicText: '#1E2229',     // Deep space dark gray for super sharp reading
      },
      boxShadow: {
        'glass-glow': '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
        'solar-glow': '0 0 20px rgba(255, 159, 28, 0.3)',
        'electric-glow': '0 0 20px rgba(58, 134, 255, 0.3)',
      }
    },
  },
  plugins: [],
}