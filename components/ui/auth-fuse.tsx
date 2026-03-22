"use client";

import * as React from "react";
import { useEffect, useId, useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { Eye, EyeOff } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TypewriterProps {
  text: string | string[];
  speed?: number;
  cursor?: string;
  loop?: boolean;
  deleteSpeed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({
  text,
  speed = 100,
  cursor = "|",
  loop = false,
  deleteSpeed = 50,
  delay = 1500,
  className,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textArrayIndex, setTextArrayIndex] = useState(0);

  const textArray = Array.isArray(text) ? text : [text];
  const currentText = textArray[textArrayIndex] || "";

  useEffect(() => {
    if (!currentText) return;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (currentIndex < currentText.length) {
          setDisplayText((prev) => prev + currentText[currentIndex]);
          setCurrentIndex((prev) => prev + 1);
        } else if (loop) {
          setTimeout(() => setIsDeleting(true), delay);
        }
      } else if (displayText.length > 0) {
        setDisplayText((prev) => prev.slice(0, -1));
      } else {
        setIsDeleting(false);
        setCurrentIndex(0);
        setTextArrayIndex((prev) => (prev + 1) % textArray.length);
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(timeout);
  }, [
    currentIndex,
    currentText,
    delay,
    deleteSpeed,
    displayText,
    isDeleting,
    loop,
    speed,
    textArray.length,
  ]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">{cursor}</span>
    </span>
  );
}

const labelVariants = cva(
  "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(0,0,0,0.26)] hover:brightness-105",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input/80 bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        ghost:
          "text-foreground/70 hover:bg-accent hover:text-foreground",
        link:
          "rounded-none px-0 py-0 text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-4",
        lg: "h-12 px-6",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[1.1rem] border border-input bg-background/85 px-4 py-3 text-sm text-foreground shadow-sm shadow-black/5 transition-all placeholder:text-muted-foreground/70 focus-visible:border-[rgba(124,130,255,0.5)] focus-visible:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, ...props }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="grid w-full items-center gap-2">
        {label && (
          <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.28em] text-foreground/72">
            {label}
          </Label>
        )}
        <div className="relative">
          <Input
            id={id}
            type={showPassword ? "text" : "password"}
            className={cn("pe-11", className)}
            ref={ref}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 end-0 flex h-full w-11 items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export type AuthFuseMode = "login" | "register";

interface AuthContentProps {
  image?: {
    src: string;
    alt: string;
  };
  quote?: {
    text: string;
    author: string;
  };
}

export interface AuthUIProps {
  mode: AuthFuseMode;
  email: string;
  password: string;
  loading?: boolean;
  error?: string;
  onModeChange: (mode: AuthFuseMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack?: () => void;
  onContinueAsGuest?: () => void;
  signInContent?: AuthContentProps;
  signUpContent?: AuthContentProps;
}

const defaultSignInContent = {
  image: {
    src: "/auth-chess-piece.svg",
    alt: "Minimal chess knight artwork",
  },
  quote: {
    text: "Welcome back to the board.",
    author: "chess",
  },
};

const defaultSignUpContent = {
  image: {
    src: "/auth-chess-piece.svg",
    alt: "Minimal chess knight artwork",
  },
  quote: {
    text: "Every serious game starts with an opening.",
    author: "chess",
  },
};

export function AuthUI({
  mode,
  email,
  password,
  loading = false,
  error = "",
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onBack,
  onContinueAsGuest,
  signInContent = {},
  signUpContent = {},
}: AuthUIProps) {
  const isSignIn = mode === "login";
  const finalSignInContent = {
    image: { ...defaultSignInContent.image, ...signInContent.image },
    quote: { ...defaultSignInContent.quote, ...signInContent.quote },
  };
  const finalSignUpContent = {
    image: { ...defaultSignUpContent.image, ...signUpContent.image },
    quote: { ...defaultSignUpContent.quote, ...signUpContent.quote },
  };
  const currentContent = isSignIn ? finalSignInContent : finalSignUpContent;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060608] text-foreground">
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-20 h-56 w-56 rounded-full bg-[rgba(124,130,255,0.14)] blur-[90px]" />
        <div className="absolute right-[12%] top-28 h-64 w-64 rounded-full bg-[rgba(215,182,125,0.12)] blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_42%,rgba(0,0,0,0.48)_100%)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl md:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <div className="flex items-center justify-center px-6 py-10 md:px-10 lg:px-14">
          <div className="w-full max-w-[24rem]">
            <div className="mb-6 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="border border-white/10 bg-white/[0.03] px-4 text-foreground/70 hover:bg-white/[0.06]"
              >
                Back
              </Button>
              <p className="text-[11px] uppercase tracking-[0.34em] text-foreground/48">
                Member access
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,21,0.88),rgba(8,8,12,0.94))] p-6 shadow-[0_28px_84px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-8">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--gold-soft)]/80">
                  {isSignIn ? "Sign in" : "Register"}
                </p>
                <h1 className="font-[var(--font-display)] text-4xl leading-none tracking-[-0.04em] text-white sm:text-5xl">
                  {isSignIn ? "Enter the room." : "Create your account."}
                </h1>
                <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                  {isSignIn
                    ? "Continue to saved games, engines, and online play."
                    : "Create an account to keep your archive and return sessions."}
                </p>
              </div>

              <div className="mt-8 rounded-full border border-white/8 bg-white/[0.03] p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => onModeChange("login")}
                    className={cn(
                      "rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                      isSignIn
                        ? "bg-[linear-gradient(180deg,#d9bc84_0%,#b28a4b_100%)] text-[#100d08] shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
                        : "text-white/54 hover:text-white",
                    )}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange("register")}
                    className={cn(
                      "rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                      !isSignIn
                        ? "bg-[linear-gradient(180deg,#d9bc84_0%,#b28a4b_100%)] text-[#100d08] shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
                        : "text-white/54 hover:text-white",
                    )}
                  >
                    Register
                  </button>
                </div>
              </div>

              <form onSubmit={onSubmit} autoComplete="on" className="mt-8 flex flex-col gap-5">
                <div className="grid gap-2">
                  <Label
                    htmlFor="auth-email"
                    className="text-[11px] uppercase tracking-[0.28em] text-foreground/72"
                  >
                    Email
                  </Label>
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-[11px] uppercase tracking-[0.28em] text-foreground/72">
                      Password
                    </Label>
                    {!isSignIn && (
                      <span className="text-xs text-muted-foreground">
                        Minimum 8 characters
                      </span>
                    )}
                  </div>
                  <PasswordInput
                    name="password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    placeholder={isSignIn ? "Enter your password" : "Create a secure password"}
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-[1.15rem] border border-[rgba(242,125,125,0.24)] bg-[rgba(116,27,27,0.24)] px-4 py-3 text-sm text-[rgba(255,190,190,0.92)]">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="mt-2 h-12 rounded-full"
                >
                  {loading
                    ? isSignIn
                      ? "Signing in..."
                      : "Creating account..."
                    : isSignIn
                      ? "Sign In"
                      : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-6 text-sm">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => onModeChange(isSignIn ? "register" : "login")}
                  className="text-foreground/60"
                >
                  {isSignIn ? "Need an account?" : "Already registered?"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onContinueAsGuest}
                  className="border border-white/10 bg-white/[0.03] px-4 text-[var(--indigo-soft)] hover:bg-white/[0.06] hover:text-white"
                >
                  Continue as guest
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden md:flex md:min-h-screen md:items-center md:justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_46%),linear-gradient(180deg,rgba(14,14,18,0.82),rgba(8,8,12,0.96))]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(215,182,125,0.16),rgba(124,130,255,0.08)_48%,transparent_74%)] blur-[110px]" />
          </div>

          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-10 py-14">
            <img
              src={currentContent.image.src}
              alt={currentContent.image.alt}
              className="max-h-[72vh] w-auto max-w-[72%] object-contain drop-shadow-[0_42px_90px_rgba(0,0,0,0.55)] transition-all duration-500 ease-out"
            />

            <blockquote className="mt-8 max-w-xl space-y-2 text-center text-foreground">
              <p className="text-xl font-medium tracking-tight text-white">
                "<Typewriter
                  key={currentContent.quote.text}
                  text={currentContent.quote.text}
                  speed={60}
                />"
              </p>
              <cite className="block text-sm font-light text-muted-foreground not-italic">
                - {currentContent.quote.author}
              </cite>
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
}
