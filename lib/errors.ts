import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "服务暂时不可用，请稍后再试。" }, { status: 500 });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AppError(403, "请求来源无效。");
  }
}
