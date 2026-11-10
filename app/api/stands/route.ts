import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { apiError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await database().query(
      "SELECT s.id, s.name FROM stands s JOIN holder_state h ON h.stand_id = s.id WHERE s.active = true ORDER BY s.created_at, s.id"
    );
    return NextResponse.json({ stands: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
