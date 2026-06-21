"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function LoyaltyScanner({ token }) {
  const [inputCardId, setInputCardId] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [message, setMessage] = useState(null);
  const scannerRef = useRef(null);

  // Fetch the current card details if a card is selected
  const card = useQuery(
    api.loyalty.getCard,
    selectedCardId ? { cardId: selectedCardId } : "skip"
  );

  const addStampMutation = useMutation(api.loyalty.addStamp);
  const redeemCardMutation = useMutation(api.loyalty.redeemCard);

  // Reset messages after 4 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const triggerPushNotification = async (pushTokens) => {
    if (!pushTokens || pushTokens.length === 0) return;
    try {
      await fetch("/api/passes/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushTokens }),
      });
    } catch (err) {
      console.error("Fehler beim Senden des Push-Updates:", err);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setScanError(null);
    const cleanedId = inputCardId.trim();
    if (!cleanedId) return;

    // Check if it's a full URL and extract the ID
    let finalId = cleanedId;
    if (cleanedId.includes("/loyalty?id=")) {
      try {
        const url = new URL(cleanedId);
        finalId = url.searchParams.get("id");
      } catch (e) {
        // use original string if URL parsing fails
      }
    }

    if (finalId.length < 5) {
      setScanError("Ungültige Karten-ID.");
      return;
    }

    setSelectedCardId(finalId);
  };

  const handleAddStamp = async () => {
    if (!selectedCardId) return;
    try {
      const res = await addStampMutation({ cardId: selectedCardId });
      setMessage({ type: "success", text: `Stempel erfolgreich hinzugefügt! Stand: ${res.stamps} von 10.` });
      // Trigger Apple Wallet push notification
      await triggerPushNotification(res.pushTokens);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Fehler beim Hinzufügen des Stempels." });
    }
  };

  const handleRedeem = async () => {
    if (!selectedCardId) return;
    try {
      const res = await redeemCardMutation({ cardId: selectedCardId });
      setMessage({ type: "success", text: "Frei-Crêpe erfolgreich eingelöst! Die Karte wurde zurückgesetzt." });
      // Trigger Apple Wallet push notification
      await triggerPushNotification(res.pushTokens);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Fehler beim Einlösen." });
    }
  };

  const startScanner = async () => {
    setScanError(null);
    setScannerActive(true);

    try {
      // Dynamic import to prevent SSR errors
      const { Html5Qrcode } = await import("html5-qrcode");
      
      // Wait for DOM container to render
      setTimeout(async () => {
        try {
          const html5Qrcode = new Html5Qrcode("reader");
          scannerRef.current = html5Qrcode;

          await html5Qrcode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              },
            },
            (decodedText) => {
              // On scan success
              let finalId = decodedText;
              if (decodedText.includes("id=")) {
                try {
                  const url = new URL(decodedText);
                  finalId = url.searchParams.get("id") || decodedText;
                } catch (e) {}
              }
              setSelectedCardId(finalId);
              setInputCardId(finalId);
              stopScanner();
            },
            (errorMessage) => {
              // Silent scan error (polling scans)
            }
          );
        } catch (err) {
          console.error("Scanner konnte nicht gestartet werden:", err);
          setScanError("Kamera-Zugriff verweigert oder keine Kamera gefunden.");
          setScannerActive(false);
        }
      }, 100);
    } catch (err) {
      setScanError("Fehler beim Laden des Scanners.");
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop()
        .then(() => {
          setScannerActive(false);
          scannerRef.current = null;
        })
        .catch((err) => console.error("Fehler beim Stoppen des Scanners:", err));
    } else {
      setScannerActive(false);
    }
  };

  return (
    <div className="loyalty-scanner-container" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem", color: "var(--accent)" }}>🥞 Stempelkarten-Scanner</h2>

      {/* Info & Error Messages */}
      {scanError && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{scanError}</div>}
      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: "1rem" }}>
          {message.text}
        </div>
      )}

      <div className="card-panel" style={{ background: "var(--bg-card)", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", marginBottom: "1.5rem" }}>
        
        {/* Scanner Area */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          {scannerActive ? (
            <div>
              <div id="reader" style={{ width: "100%", maxWidth: "350px", margin: "0 auto 1rem", borderRadius: "8px", overflow: "hidden", border: "2px solid var(--accent)" }}></div>
              <button className="btn btn-secondary" onClick={stopScanner}>Scanner stoppen</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={startScanner} style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", gap: "0.5rem" }}>
              📷 Kamera-Scanner aktivieren
            </button>
          )}
        </div>

        {/* Manual Input */}
        <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Karten-ID oder QR-Code Link manuell eingeben"
            value={inputCardId}
            onChange={(e) => setInputCardId(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">Laden</button>
        </form>

        {selectedCardId && (
          <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
            Geladene ID: <code>{selectedCardId}</code>
          </div>
        )}
      </div>

      {/* Card Detail / Stamp Dashboard */}
      {selectedCardId && (
        <div className="card-panel" style={{ background: "var(--bg-card)", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {card === undefined ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>Treuekarte wird geladen...</div>
          ) : card === null ? (
            <div className="alert alert-error" style={{ textAlign: "center" }}>
              Keine gültige Treuekarte unter dieser ID gefunden.
            </div>
          ) : (
            <div>
              {/* Customer Header */}
              <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>{card.customerName}</h3>
                <span className="terminal-badge" style={{ marginTop: "0.5rem", background: card.stamps === 10 ? "var(--success)" : "var(--accent)" }}>
                  {card.stamps} von 10 Stempeln
                </span>
                {card.redeemedCount > 0 && (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "1rem" }}>
                    ({card.redeemedCount}x eingelöst)
                  </span>
                )}
              </div>

              {/* Visual Stamp Card Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "2rem" }}>
                {Array.from({ length: 10 }).map((_, index) => {
                  const isStamped = index < card.stamps;
                  const isLast = index === 9;
                  return (
                    <div
                      key={index}
                      style={{
                        aspectRatio: "1/1",
                        borderRadius: "50%",
                        border: isStamped ? "2px solid var(--accent)" : "2px dashed var(--border)",
                        background: isStamped ? "rgba(218,165,32,0.15)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        position: "relative",
                        color: isStamped ? "var(--accent)" : "var(--text-muted)",
                        fontWeight: "bold",
                        boxShadow: isStamped ? "0 0 8px rgba(218,165,32,0.3)" : "none",
                        transition: "all 0.3s ease",
                      }}
                    >
                      {isStamped ? (isLast ? "🎁" : "🥞") : index + 1}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {card.stamps < 10 ? (
                  <button
                    className="btn btn-primary"
                    onClick={handleAddStamp}
                    style={{ width: "100%", padding: "1rem", fontSize: "1.05rem" }}
                  >
                    🥞 +1 Stempel hinzufügen
                  </button>
                ) : (
                  <div style={{ background: "rgba(76, 175, 80, 0.15)", border: "1px solid var(--success)", padding: "1rem", borderRadius: "8px", textAlign: "center", marginBottom: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem", color: "var(--success)", fontSize: "1.1rem" }}>🎁 10 Stempel voll!</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                      Der Kunde erhält diese Bestellung gratis. Nach Erhalt hier einlösen, um die Karte zurückzusetzen.
                    </p>
                    <button
                      className="btn btn-success"
                      onClick={handleRedeem}
                      style={{ width: "100%", padding: "1rem", fontSize: "1.05rem", background: "var(--success)", borderColor: "var(--success)" }}
                    >
                      Kostenlosen Crêpe einlösen
                    </button>
                  </div>
                )}
                
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedCardId(null);
                    setInputCardId("");
                  }}
                  style={{ width: "100%" }}
                >
                  Anderen Kunden scannen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
