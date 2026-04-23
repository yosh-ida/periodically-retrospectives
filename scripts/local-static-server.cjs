const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const port = Number(process.argv[3] || "4174");

if (!root) {
  throw new Error("Root directory is required");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const safePath = requestPath.replace(/^\/+/, "");
  let filePath = path.join(root, safePath);

  if (requestPath.endsWith("/")) {
    filePath = path.join(root, safePath, "index.html");
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    response.setHeader(
      "Content-Type",
      mimeTypes[path.extname(filePath)] || "application/octet-stream",
    );
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, "127.0.0.1");
