"use client";

import { useRouter, useParams } from "next/navigation";
import OrderConfirmation from "../../../src/components/OrderConfirmation";

export default function OrderPage() {
  const router = useRouter();
  const params = useParams();
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
      </header>
      <OrderConfirmation orderId={params.id} navigate={navigate} />
    </div>
  );
}
