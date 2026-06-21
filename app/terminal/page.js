"use client";

import { useRouter } from "next/navigation";
import Terminal from "../../src/components/Terminal";

export default function TerminalPage() {
  const router = useRouter();
  const navigate = (to) => router.push(to);

  return <Terminal navigate={navigate} />;
}
