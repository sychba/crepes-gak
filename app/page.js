"use client";

import { useRouter } from "next/navigation";
import CustomerOrder from "../src/components/CustomerOrder";

export default function HomePage() {
  const router = useRouter();
  const navigate = (to) => router.push(to);

  return (
    <div className="app-container">
      <header className="header" style={{ justifyContent: "center" }}>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          className="logo-container"
        >
          <span className="logo-icon">🥞</span>
          <span className="logo-text">Crepes GAK</span>
        </a>
        <a
          href="/loyalty"
          onClick={(e) => {
            e.preventDefault();
            navigate("/loyalty");
          }}
          className="terminal-badge"
          style={{ position: "absolute", right: "2rem", textDecoration: "none", fontSize: "0.85rem", background: "var(--accent)" }}
        >
          🎁 Treuekarte
        </a>
      </header>
      <CustomerOrder navigate={navigate} />
    </div>
  );
}
