import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const securityCode = process.env.AMAP_SECURITY_CODE;
  if (!securityCode) return Response.json({ error: "地图服务尚未配置。" }, { status: 503 });
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    return Response.json({ error: "无效的地图服务路径。" }, { status: 400 });
  }
  const suffix = path.join("/");
  const host = suffix.startsWith("v4/map/styles") ? "https://webapi.amap.com" : "https://restapi.amap.com";
  const upstreamUrl = new URL(`/${suffix}`, host);
  request.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));
  upstreamUrl.searchParams.set("jscode", securityCode);
  const headers = new Headers();
  for (const name of ["accept", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "地图服务暂时不可用。" }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}
