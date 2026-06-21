import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generatePass } from "@/src/lib/passGenerator";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "https://knowing-gazelle-93.convex.cloud");

// Verifiziert, ob das Authorization Token mit dem AuthToken der Stempelkarte übereinstimmt
async function authenticate(request, serialNumber) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("ApplePass ")) {
    return false;
  }
  const token = authHeader.replace("ApplePass ", "").trim();
  
  try {
    const card = await convex.query(api.loyalty.getCard, { cardId: serialNumber });
    return card && card.authToken === token;
  } catch (err) {
    console.error("Auth-Query fehlgeschlagen für Karte:", serialNumber, err);
    return false;
  }
}

// GET: Apple Wallet holt die neueste Version des Passes (z. B. nach einem Push)
export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { passTypeIdentifier, serialNumber } = resolvedParams;
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  try {
    const isAuthenticated = await authenticate(request, serialNumber);
    if (!isAuthenticated) {
      return new Response("Nicht autorisiert", { status: 401 });
    }

    const card = await convex.query(api.loyalty.getCard, { cardId: serialNumber });
    if (!card) {
      return new Response("Karte nicht gefunden", { status: 404 });
    }

    const passBuffer = await generatePass({
      cardId: card._id,
      customerName: card.customerName,
      stamps: card.stamps,
      authToken: card.authToken,
      baseUrl,
    });

    return new Response(passBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    console.error("Fehler beim Erzeugen des aktualisierten Passes:", err);
    return new Response("Interner Fehler", { status: 500 });
  }
}
