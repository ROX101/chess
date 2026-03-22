"use client";

import {
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  glowColor?: string;
  backgroundColor?: string;
  textColor?: string;
  hoverTextColor?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
}

function HoverButton({
  children,
  onClick,
  className = "",
  disabled = false,
  glowColor = "#00ffc3",
  backgroundColor = "#111827",
  textColor = "#ffffff",
  hoverTextColor = "#67e8f9",
  type = "button",
}: ButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setGlowPosition({ x, y });
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative inline-block overflow-hidden border-none px-8 py-4
        font-sans text-xl transition-colors duration-300
        rounded-lg cursor-pointer z-10
        ${disabled ? "cursor-not-allowed opacity-50" : ""}
        ${className}
      `}
      style={{
        backgroundColor,
        color: isHovered ? hoverTextColor : textColor,
      }}
    >
      <div
        className={`
          pointer-events-none absolute h-[200px] w-[200px]
          -translate-x-1/2 -translate-y-1/2 rounded-full
          opacity-50 transition-transform duration-300 ease-out
          ${isHovered ? "scale-[1.2]" : "scale-0"}
        `}
        style={{
          left: `${glowPosition.x}px`,
          top: `${glowPosition.y}px`,
          background: `radial-gradient(circle, ${glowColor} 10%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      <span className="relative z-10">{children}</span>
    </button>
  );
}

export { HoverButton };
