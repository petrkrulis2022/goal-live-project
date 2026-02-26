import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Dynamic match viewer — same source as matchlive but on port 5177
// Open with URL params for any match, e.g.:
//   http://localhost:5177/?goalserveLeague=1009&goalserveStaticId=0
//     &oddsEventId=a10622ef3df1fc281776c68135e9ea03
//     &sport=soccer_uefa_europa_conference_league
//     &home=FC+Lausanne-Sport&away=Sigma+Olomouc
//     &competition=UEFA+Europa+Conference+League&kickoff=21:00+CET
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "match-live"),
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist-matchlive2"),
    emptyOutDir: true,
  },
  css: {
    postcss: path.resolve(__dirname, "postcss.config.js"),
  },
  server: {
    port: 5177,
    proxy: {
      "/api/goalserve": {
        target: "http://www.goalserve.com",
        changeOrigin: true,
        rewrite: (p) =>
          p.replace(
            "/api/goalserve",
            "/getfeed/5dc9cf20aca34682682708de71344f52",
          ),
      },
      "/api/odds": {
        target: "https://api.the-odds-api.com",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace("/api/odds", "/v4"),
      },
    },
  },
});
