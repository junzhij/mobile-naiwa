import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { apiError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await database().query("SELECT v.id, v.sequence, v.latitude, v.longitude, v.place_name, s.id AS stand_id, s.name AS stand_name FROM visits v JOIN stands s ON s.id = v.stand_id WHERE v.hidden = false ORDER BY v.sequence ASC");
    return NextResponse.json({ locations: result.rows.map((row) => ({ id: row.id, sequence: Number(row.sequence), latitude: row.latitude, longitude: row.longitude, placeName: row.place_name, standId: row.stand_id, standName: row.stand_name })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
