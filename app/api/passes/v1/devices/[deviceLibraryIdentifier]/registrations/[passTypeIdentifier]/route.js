import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

// GET: Apple fragt nach den Seriennummern der geänderten Pässe seit dem Zeitstempel
export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { deviceLibraryIdentifier, passTypeIdentifier } = resolvedParams;

  const { searchParams } = new URL(request.url);
  const passesUpdatedSince = searchParams.get("passesUpdatedSince") || undefined;

  try {
    const result = await convex.query(api.loyalty.getUpdatedSerials, {
      deviceLibraryIdentifier,
      passesUpdatedSince,
    });

    // Wenn keine geänderten Seriennummern vorliegen, liefert der Server laut Spezifikation 204 No Content
    if (!result.serialNumbers || result.serialNumbers.length === 0) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json({
      lastUpdated: result.lastUpdated,
      serialNumbers: result.serialNumbers,
    });
  } catch (err) {
    console.error("Fehler beim Holen der aktualisierten Seriennummern:", err);
    return new Response("Interner Fehler", { status: 500 });
  }
}
