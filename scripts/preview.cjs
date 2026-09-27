const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};
http
  .createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    if (pathname === "/") {
      response.writeHead(302, { Location: "/ui/setup/index.html" });
      response.end();
      return;
    }
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(target, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(content);
    });
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Tiny Menaces preview: http://127.0.0.1:4173/"),
  );
