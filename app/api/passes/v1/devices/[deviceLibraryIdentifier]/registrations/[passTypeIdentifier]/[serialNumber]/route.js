import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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

// POST: Apple Wallet registriert ein Gerät für Push-Benachrichtigungen
export async function POST(request, { params }) {
  const resolvedParams = await params;
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = resolvedParams;

  try {
    const isAuthenticated = await authenticate(request, serialNumber);
    if (!isAuthenticated) {
      return new Response("Nicht autorisiert", { status: 401 });
    }

    const body = await request.json();
    const { pushToken } = body;

    if (!pushToken) {
      return NextResponse.json({ error: "Fehlendes pushToken im Body" }, { status: 400 });
    }

    await convex.mutation(api.loyalty.registerDevice, {
      serialNumber,
      deviceLibraryIdentifier,
      pushToken,
    });

    // 201 Created (oder 200 OK wenn bereits registriert, 201 ist laut Apple sicher)
    return new Response("Registriert", { status: 201 });
  } catch (err) {
    console.error("Fehler bei Registrierung des Apple Geräts:", err);
    return new Response("Interner Fehler", { status: 500 });
  }
}

// DELETE: Apple Wallet entfernt die Registrierung für das Gerät
export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = resolvedParams;

  try {
    const isAuthenticated = await authenticate(request, serialNumber);
    if (!isAuthenticated) {
      return new Response("Nicht autorisiert", { status: 401 });
    }

    await convex.mutation(api.loyalty.unregisterDevice, {
      serialNumber,
      deviceLibraryIdentifier,
    });

    return new Response("Gelöscht", { status: 200 });
  } catch (err) {
    console.error("Fehler beim Abmelden des Apple Geräts:", err);
    return new Response("Interner Fehler", { status: 500 });
  }
}
