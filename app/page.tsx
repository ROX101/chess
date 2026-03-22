"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { HoverButton } from "@/components/ui/hover-glow-button";
import { RippleButton } from "@/components/ui/ripple-button";

export default function HomePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (email) setUserEmail(email);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setUserEmail("");
  }

  function enterPlay(mode: "local" | "computer") {
    sessionStorage.setItem("chessEntryMode", mode);
    router.push("/play");
  }

  return (
    <main className="relative min-h-screen text-white">
      <header className="absolute inset-x-4 top-4 z-20 sm:inset-x-6 lg:inset-x-8">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between rounded-full border border-white/10 bg-[rgba(10,10,16,0.5)] px-4 py-3 backdrop-blur-xl sm:px-6">
          <button onClick={() => router.push("/")} className="text-left">
            <p className="lux-kicker">chess</p>
            <p className="mt-1 text-sm text-white/64">Board access</p>
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <RippleButton
              variant="ghost"
              onClick={() => router.push("/games")}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              History
            </RippleButton>
            {userEmail ? (
              <>
                <span className="hidden rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-white/60 sm:block">
                  {userEmail}
                </span>
                <RippleButton
                  variant="ghost"
                  onClick={handleLogout}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/72 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white"
                >
                  Logout
                </RippleButton>
              </>
            ) : (
              <RippleButton
                variant="ghost"
                onClick={() => router.push("/auth")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/72 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                Sign in
              </RippleButton>
            )}
          </div>
        </div>
      </header>

      <BackgroundPaths
        title="chess"
        showDefaultAction={false}
        contentClassName="pt-20 sm:pt-24"
      >
        <p className="mx-auto max-w-md text-sm leading-7 text-white/56 sm:text-base">
          Choose your board and enter immediately.
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <HoverButton
            onClick={() => enterPlay("local")}
            glowColor="#d7b67d"
            backgroundColor="rgba(11,11,17,0.92)"
            textColor="#f5f1e8"
            hoverTextColor="#f0ddba"
            className="w-full min-w-[12rem] rounded-full border border-[rgba(215,182,125,0.22)] px-7 py-4 text-base font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.26)] sm:w-auto"
          >
            Play Local
          </HoverButton>
          <HoverButton
            onClick={() => enterPlay("computer")}
            glowColor="#7c82ff"
            backgroundColor="rgba(11,11,17,0.92)"
            textColor="#f5f1e8"
            hoverTextColor="#dfe2ff"
            className="w-full min-w-[12rem] rounded-full border border-[rgba(124,130,255,0.22)] px-7 py-4 text-base font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.26)] sm:w-auto"
          >
            Play Computer
          </HoverButton>
          <HoverButton
            onClick={() => router.push("/multiplayer")}
            glowColor="#46c499"
            backgroundColor="rgba(11,11,17,0.92)"
            textColor="#f5f1e8"
            hoverTextColor="#bdf6e3"
            className="w-full min-w-[12rem] rounded-full border border-[rgba(70,196,153,0.22)] px-7 py-4 text-base font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.26)] sm:w-auto"
          >
            Play Online
          </HoverButton>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/42">
          <a href="/play" className="transition-colors hover:text-white/78">Solo room</a>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <a href="/multiplayer" className="transition-colors hover:text-white/78">Live room</a>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <a href={userEmail ? "/games" : "/auth"} className="transition-colors hover:text-white/78">
            {userEmail ? "Archive" : "Member access"}
          </a>
        </div>
      </BackgroundPaths>
    </main>
  );
}
