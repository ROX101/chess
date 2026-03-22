import { useState } from "react";

import { AuthUI, type AuthFuseMode } from "@/components/ui/auth-fuse";

export default function DemoAuthFuse() {
  const [mode, setMode] = useState<AuthFuseMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthUI
      mode={mode}
      email={email}
      password={password}
      onModeChange={setMode}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={(event) => event.preventDefault()}
    />
  );
}
