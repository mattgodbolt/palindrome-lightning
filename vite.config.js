import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "/palindrome-lightning/",
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "slides/*.md",
          dest: ".",
        },
        {
          src: "images",
          dest: ".",
        },
      ],
    }),
    {
      name: "md-reload",
      configureServer(server) {
        server.watcher.add("slides/*.md");
        server.watcher.on(
          "change",
          (file) => file.endsWith(".md") && server.ws.send({ type: "full-reload" }),
        );
      },
    },
  ],
});
