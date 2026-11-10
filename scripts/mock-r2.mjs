import { createServer } from "node:http";

const objects = new Map();
const bucket = process.env.R2_BUCKET || "naiwa-test";
const origin = process.env.TEST_ORIGIN || "http://localhost:3100";

createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, x-amz-copy-source, x-amz-content-sha256, x-amz-date, authorization, x-amz-security-token");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const prefix = `/${bucket}/`;
  if (!pathname.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
  const key = decodeURIComponent(pathname.slice(prefix.length));
  if (request.method === "PUT") {
    const source = request.headers["x-amz-copy-source"];
    if (source) {
      const sourceKey = decodeURIComponent(String(source).replace(/^\//, "").replace(new RegExp(`^${bucket}/`), ""));
      const item = objects.get(sourceKey);
      if (!item) { response.writeHead(404); response.end(); return; }
      objects.set(key, { body: item.body, type: request.headers["content-type"] || item.type });
      response.setHeader("Content-Type", "application/xml");
      response.end(`<CopyObjectResult><ETag>"test-etag"</ETag><LastModified>${new Date().toISOString()}</LastModified></CopyObjectResult>`);
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    objects.set(key, { body: Buffer.concat(chunks), type: request.headers["content-type"] || "application/octet-stream" });
    response.setHeader("ETag", '"test-etag"');
    response.writeHead(200); response.end(); return;
  }
  if (request.method === "DELETE") { objects.delete(key); response.writeHead(204); response.end(); return; }
  const item = objects.get(key);
  if (!item) { response.writeHead(404); response.end(); return; }
  response.setHeader("Content-Type", item.type);
  response.setHeader("Content-Length", String(item.body.length));
  if (request.method === "HEAD") { response.writeHead(200); response.end(); return; }
  if (request.method === "GET") { response.writeHead(200); response.end(item.body); return; }
  response.writeHead(405); response.end();
}).listen(Number(process.env.MOCK_R2_PORT || 9100), "127.0.0.1", () => console.log(`Mock R2 ready on port ${process.env.MOCK_R2_PORT || 9100}`));
