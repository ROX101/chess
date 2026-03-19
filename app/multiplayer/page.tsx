"use client";

import dynamic from "next/dynamic";

const MultiplayerGame = dynamic(() => import("./MultiplayerGame"), { ssr: false });

export default function MultiplayerPage() {
  return <MultiplayerGame />;
}