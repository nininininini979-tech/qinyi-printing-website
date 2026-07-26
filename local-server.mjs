import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = resolve(import.meta.dirname);
const API_ORIGIN = "https://qinyi-ai-support-private-api.vercel.app";
const MAX_REQUEST_BYTES = 1024 * 1024;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyApi(req, res, pathname) {
  let body;
  try {
    body = await readRequestBody(req);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      send(res, 413, JSON.stringify({ error: "请求内容过大" }), "application/json; charset=utf-8");
      return;
    }
    throw error;
  }

  const headers = {};
  for (const name of ["content-type", "x-client-id", "x-demo-user-id", "x-user-id", "x-tenant-id"]) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }

  const upstream = await fetch(`${API_ORIGIN}${pathname}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    redirect: "manual",
  });

  const responseHeaders = {
    "Cache-Control": "no-store",
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  };
  for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders[name] = value;
  }

  res.writeHead(upstream.status, responseHeaders);
  if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
  else res.end();
}

async function serveStatic(res, pathname) {
  const decodedPath = decodeURIComponent(pathname.slice(1));
  const relativePath = pathname === "/" ? "index.html" : pathname.endsWith("/") ? `${decodedPath}index.html` : decodedPath;
  const filePath = resolve(ROOT, relativePath);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${sep}`)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": stat.size,
      "Content-Type": CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      send(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || HOST}`);
    if (url.pathname.startsWith("/api/support/")) {
      await proxyApi(req, res, `${url.pathname}${url.search}`);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "Method not allowed");
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    send(res, 502, JSON.stringify({ error: "本地服务暂时不可用" }), "application/json; charset=utf-8");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Qinyi Printing website: http://${HOST}:${PORT}`);
});
