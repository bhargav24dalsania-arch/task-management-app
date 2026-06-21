const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 3000;
const stateFile = path.join(root, "taskflow-shared-state.json");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(request.url.split("?")[0]);

  if (requestPath === "/api/state" && request.method === "GET") {
    fs.readFile(stateFile, "utf8", (error, content) => {
      if (error) return sendJson(response, 200, { ok: true, state: null, updatedAt: null });
      try {
        sendJson(response, 200, JSON.parse(content));
      } catch (parseError) {
        sendJson(response, 200, { ok: true, state: null, updatedAt: null });
      }
    });
    return;
  }

  if (requestPath === "/api/state" && request.method === "POST") {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) request.destroy();
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const output = {
          ok: true,
          updatedAt: payload.updatedAt || new Date().toISOString(),
          score: Number(payload.score || 0),
          state: payload.state || {}
        };
        const tempFile = `${stateFile}.tmp`;
        fs.writeFile(tempFile, JSON.stringify(output, null, 2), "utf8", writeError => {
          if (writeError) return sendJson(response, 500, { ok: false, error: writeError.message });
          fs.rename(tempFile, stateFile, renameError => {
            if (renameError) return sendJson(response, 500, { ok: false, error: renameError.message });
            sendJson(response, 200, output);
          });
        });
      } catch (error) {
        sendJson(response, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
});

server.on("error", error => {
  console.error("");
  console.error("TaskFlow could not start.");
  if (error.code === "EADDRINUSE") {
    console.error("Port 3000 is already in use. Close the other app using port 3000, then try again.");
  } else {
    console.error(error.message);
  }
  console.error("");
  console.error("Press Ctrl+C or close this window after reading the error.");
  process.stdin.resume();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TaskFlow running at http://127.0.0.1:${port}`);
  console.log("Keep this window open while using the app.");
});
