import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { signedPhoto } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Photo = { id: string; key: string };
type Row = {
  id: string; sequence: string; created_at: Date; caption: string | null; place_name: string | null;
  latitude: number; longitude: number; location_source: "gps" | "manual"; stand_id: string; stand_name: string; photos: Photo[];
};

export async function GET(request: NextRequest) {
  try {
    const cursorText = request.nextUrl.searchParams.get("cursor");
    const cursor = cursorText && /^\d+$/.test(cursorText) ? Number(cursorText) : null;
    const result = await database().query<Row>(
      `SELECT v.id, v.sequence, v.created_at, v.caption, v.place_name, v.latitude, v.longitude, v.location_source,
       s.id AS stand_id, s.name AS stand_name,
       COALESCE(json_agg(json_build_object('id', p.id, 'key', p.object_key) ORDER BY p.sort_order)
       FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS photos
       FROM visits v JOIN stands s ON s.id = v.stand_id LEFT JOIN photos p ON p.visit_id = v.id
       WHERE v.hidden = false AND ($1::bigint IS NULL OR v.sequence < $1)
       GROUP BY v.id, s.id, s.name ORDER BY v.sequence DESC LIMIT 21`, [cursor]
    );
    const page = result.rows.slice(0, 20);
    const entries = await Promise.all(page.map(async (row) => ({
      id: row.id,
      standId: row.stand_id,
      standName: row.stand_name,
      sequence: Number(row.sequence),
      createdAt: row.created_at,
      caption: row.caption,
      placeName: row.place_name,
      latitude: row.latitude,
      longitude: row.longitude,
      locationSource: row.location_source,
      photos: await Promise.all(row.photos.map(async (photo) => ({ id: photo.id, url: await signedPhoto(photo.key) }))),
    })));
    return NextResponse.json({ entries, nextCursor: result.rows.length > 20 ? Number(page.at(-1)?.sequence) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
