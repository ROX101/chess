"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AuthUI, type AuthFuseMode } from "@/components/ui/auth-fuse";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthFuseMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("userEmail", data.email);
      router.push("/play");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  function handleModeChange(nextMode: AuthFuseMode) {
    setMode(nextMode);
    setError("");
    setEmail("");
    setPassword("");
  }

  return (
    <AuthUI
      mode={mode}
      email={email}
      password={password}
      loading={loading}
      error={error}
      onModeChange={handleModeChange}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      onBack={() => router.push("/")}
      onContinueAsGuest={() => router.push("/play")}
    />
  );
}
