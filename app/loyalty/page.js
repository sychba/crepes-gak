"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import QRCode from "qrcode";

export default function LoyaltyPage() {
  const [cardId, setCardId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  // Checks URL query parameters or localStorage for card ID on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get("id");
    const idFromStorage = localStorage.getItem("crepes_loyalty_card_id");

    if (idFromUrl) {
      setCardId(idFromUrl);
      localStorage.setItem("crepes_loyalty_card_id", idFromUrl);
      // Remove query param to clean up URL
      window.history.replaceState({}, document.title, "/loyalty");
    } else if (idFromStorage) {
      setCardId(idFromStorage);
    }
  }, []);

  // Fetch the card from Convex in real-time
  const card = useQuery(
    api.loyalty.getCard,
    cardId ? { cardId: cardId } : "skip"
  );

  const createCardMutation = useMutation(api.loyalty.createCard);

  // If card doesn't exist in DB but we had an ID (e.g. database reset)
  useEffect(() => {
    if (cardId && card === null) {
      localStorage.removeItem("crepes_loyalty_card_id");
      setCardId(null);
      setError("Deine Karte wurde im System nicht gefunden. Bitte erstelle eine neue.");
    }
  }, [card, cardId]);

  // Render QR Code to Canvas when card is loaded
  useEffect(() => {
    if (canvasRef.current && cardId) {
      const protocol = window.location.protocol;
      const host = window.location.host;
      const qrUrl = `${protocol}//${host}/loyalty?id=${cardId}`;

      QRCode.toCanvas(
        canvasRef.current,
        qrUrl,
        {
          width: 200,
          margin: 1,
          color: {
            dark: "#2a1810", // Dark brown matching theme
            light: "#ffffff",
          },
        },
        (err) => {
          if (err) console.error("Fehler beim Generieren des QR-Codes:", err);
        }
      );
    }
  }, [cardId, card?.stamps]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim()) return;

    setCreating(true);
    try {
      // Generate a secure random token for pass download authentication
      const tokenArray = new Uint8Array(16);
      window.crypto.getRandomValues(tokenArray);
      const authToken = Array.from(tokenArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const newCardId = await createCardMutation({
        customerName: customerName.trim(),
        authToken,
      });

      localStorage.setItem("crepes_loyalty_card_id", newCardId);
      setCardId(newCardId);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Erstellen der Treuekarte. Bitte versuche es erneut.");
    } finally {
      setCreating(false);
    }
  };

  const handleResetCard = () => {
    if (confirm("Möchtest du diese Treuekarte wirklich von diesem Gerät entfernen?")) {
      localStorage.removeItem("crepes_loyalty_card_id");
      setCardId(null);
      setCustomerName("");
      setError(null);
    }
  };

  // 1. REGISTRATION SCREEN (No Card yet)
  if (!cardId) {
    return (
      <div className="login-container" style={{ maxWidth: "420px", marginTop: "4rem" }}>
        <div className="login-icon">🥞</div>
        <h2 className="login-title">Crêpes GAK Club</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem", textAlign: "center" }}>
          Sammle Stempel bei jedem Kauf! Für jeden Crêpe gibt es einen Stempel. Nach 5 Stempeln erhältst du dein Gratis-Crêpe!
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleRegister} className="login-form">
          <div className="form-group" style={{ textAlign: "left" }}>
            <label htmlFor="customer-name">Dein Name</label>
            <input
              id="customer-name"
              type="text"
              className="form-input"
              placeholder="z. B. Max Mustermann"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              disabled={creating}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={creating}>
            {creating ? "Karte wird erstellt..." : "Jetzt Stempelkarte sichern"}
          </button>
        </form>

        <a
          href="/"
          className="btn btn-secondary"
          style={{ marginTop: "1rem", display: "block", textDecoration: "none", fontSize: "0.85rem" }}
        >
          Zurück zum Bestellsystem
        </a>
      </div>
    );
  }

  // 2. LOADING STATE
  if (card === undefined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <span style={{ fontSize: "3rem", animation: "spin 2s linear infinite" }}>🥞</span>
        <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>Deine Treuekarte wird geladen...</p>
      </div>
    );
  }

  // 3. PASS DASHBOARD
  const isCardFull = card.stamps === 5;

  return (
    <div style={{ maxWidth: "480px", margin: "2rem auto", padding: "0 1rem" }}>
      
      {/* Real-time sync indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "1.5rem", fontSize: "0.8rem", color: "var(--success)", background: "rgba(76, 175, 80, 0.1)", padding: "0.5rem 1rem", borderRadius: "20px" }}>
        <span style={{ width: "8px", height: "8px", background: "var(--success)", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite" }}></span>
        Echtzeit-Verbindung aktiv. Updates erfolgen automatisch.
      </div>

      {isCardFull && (
        <div className="alert alert-success" style={{ textAlign: "center", marginBottom: "1.5rem", animation: "bounce 2s infinite" }}>
          <h4 style={{ margin: "0 0 0.25rem", color: "var(--success)" }}>🎁 Glückwunsch! Karte voll!</h4>
          Dein nächster Crêpe ist gratis! Zeige den QR-Code beim Mitarbeiter vor.
        </div>
      )}

      {/* Interactive Wallet Card Mockup */}
      <div
        className={`wallet-card ${isCardFull ? "full-pulse" : ""}`}
        style={{
          background: "rgb(138, 123, 118)",
          borderRadius: "16px",
          color: "white",
          boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
          overflow: "hidden",
          position: "relative",
          marginBottom: "1.5rem",
          maxWidth: "375px",
          margin: "0 auto 1.5rem",
        }}
      >
        {/* Pass Header */}
        <div style={{ padding: "0.8rem 1.2rem 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🥞</span>
            <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "white", letterSpacing: "0.3px" }}>Stempelkarte</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.9)", fontWeight: "600", letterSpacing: "0.2px" }}>
            {card.customerName}
          </div>
        </div>

        {/* Pass Middle Section / Strip Image Background */}
        <div
          style={{
            backgroundImage: `url('/pass/strip_${card.stamps}.png')`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            width: "375px",
            height: "123px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        />

        {/* Fields Section (Progress) */}
        <div style={{ padding: "0.8rem 1.2rem 0.2rem" }}>
          <div style={{ fontSize: "0.58rem", color: "rgba(255, 255, 255, 0.75)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "0.2rem" }}>
            Stempel bis zu einer kostenlosen Bestellung:
          </div>
          <div style={{ fontWeight: "600", fontSize: "1.3rem", color: "white" }}>
            {card.stamps}/5
          </div>
        </div>

        {/* Barcode & Scan Info */}
        <div style={{ padding: "0.2rem 1.2rem 1.2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ background: "white", padding: "1rem", borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            <canvas ref={canvasRef} style={{ width: "160px", height: "160px", display: "block" }}></canvas>
            <span style={{ fontSize: "0.58rem", fontWeight: "600", color: "#666", marginTop: "0.4rem", textTransform: "uppercase", letterSpacing: "0.3px" }}>
              Am Stand zum Scannen vorzeigen
            </span>
          </div>
        </div>
      </div>

      {/* Add to Apple Wallet Button (Badge Link) */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <a
          href={`/api/passes/generate?id=${card._id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "black",
            color: "white",
            padding: "0.85rem 1.5rem",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "0.95rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            border: "1px solid rgba(255,255,255,0.1)",
            gap: "0.75rem",
            transition: "transform 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {/* Apple Wallet Icon Mock */}
          <svg width="22" height="22" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="50" height="50" rx="10" fill="#1E1E1E"/>
            <path d="M12 20C12 17.7909 13.7909 16 16 16H34C36.2091 16 38 17.7909 38 20V24H12V20Z" fill="#FF5B5B"/>
            <path d="M12 24H38V28C38 30.2091 36.2091 32 34 32H16C13.7909 32 12 30.2091 12 28V24Z" fill="#FFA33C"/>
            <path d="M14 21C14 20.4477 14.4477 20 15 20H35C35.5523 20 36 20.4477 36 21V23H14V21Z" fill="#FFCC00"/>
            <circle cx="25" cy="24" r="3" fill="white"/>
          </svg>
          Hinzufügen zu Apple Wallet
        </a>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
          Hinweis: Auf Apple-Geräten wird die Karte direkt in dein Wallet geladen.
        </p>
      </div>

      {/* Footer Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "1.2rem" }}>
        <button
          className="btn btn-secondary"
          onClick={handleResetCard}
          style={{ fontSize: "0.75rem", padding: "0.5rem 0.85rem", color: "var(--text-muted)" }}
        >
          Karte abmelden ✕
        </button>
        <a
          href="/"
          className="btn btn-secondary"
          style={{ textDecoration: "none", fontSize: "0.75rem", padding: "0.5rem 0.85rem" }}
        >
          Zum Bestellsystem 🥞
        </a>
      </div>
    </div>
  );
}
