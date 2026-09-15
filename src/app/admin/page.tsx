"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, CONFIG_ERROR } from "@/lib/supabase";

const typewriterLines = [
  "Manage your store from one place.",
  "Easily update products.",
  "Track orders in real-time.",
  "Stock management made simple.",
  "Elegance managed effortlessly.",
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const [lineIndex, setLineIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = typewriterLines[lineIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed === current) {
      timeout = setTimeout(() => setDeleting(true), 2800);
    } else if (deleting && displayed === "") {
      setDeleting(false);
      setLineIndex((i) => (i + 1) % typewriterLines.length);
    } else if (deleting) {
      timeout = setTimeout(() => setDisplayed((t) => t.slice(0, -1)), 35);
    } else {
      timeout = setTimeout(
        () => setDisplayed(current.slice(0, displayed.length + 1)),
        70
      );
    }

    return () => clearTimeout(timeout);
  }, [displayed, deleting, lineIndex]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(false);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      localStorage.setItem("admin_auth", "1");
      router.push("/admin/dashboard");
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sol panel */}
      <div className="hidden lg:flex w-[52%] bg-neutral-950 flex-col justify-between p-16 relative overflow-hidden">
        {/* Fine grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 60px), repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 60px)",
          }}
        />

        <p className="relative text-white text-[13px] tracking-[0.5em] font-light">EL&apos;S</p>

        <div className="relative">
          <p className="text-neutral-500 text-[10px] tracking-[0.45em] uppercase mb-6">
              Admin Panel
            </p>
          <div className="min-h-[100px]">
            <h2 className="text-white text-[36px] font-light leading-tight font-playfair">
              {displayed}
              <span className="inline-block w-[2px] h-[34px] bg-white/70 ml-1 align-middle animate-pulse" />
            </h2>
          </div>

          <div className="mt-10 flex gap-1.5">
            {typewriterLines.map((_, i) => (
              <div
                key={i}
                className={`h-[1px] transition-all duration-500 ${
                  i === lineIndex ? "w-6 bg-white/60" : "w-3 bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>

        <p className="relative text-neutral-600 text-[11px] tracking-wide">
          © 2026 EL&apos;S. All rights reserved.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-sm">
          <p className="text-[11px] tracking-[0.5em] text-neutral-400 uppercase mb-10 lg:hidden">
            EL&apos;S
          </p>

          <p className="text-[10px] tracking-[0.45em] text-neutral-400 uppercase mb-3">
            Admin Sign In
          </p>
          <h1 className="text-[30px] font-light text-neutral-900 mb-1 font-playfair">
            Welcome.
          </h1>
          <p className="text-[13px] text-neutral-400 font-light mb-12">
            Enter your password to continue.
          </p>

          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
              <p className="text-[13px]">{CONFIG_ERROR.message}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="text-[10px] tracking-[0.3em] text-neutral-400 uppercase block mb-3">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="••••••••"
                autoFocus
                className="w-full border-b border-neutral-200 px-0 py-3.5 text-[15px] font-light focus:outline-none focus:border-neutral-800 transition-colors bg-transparent placeholder:text-neutral-300"
                data-testid="admin-login-password"
              />
              {error && (
                <p className="text-[12px] text-red-400 mt-2.5 tracking-wide" data-testid="admin-login-error">
                  Incorrect password. Try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 bg-neutral-900 text-white text-[10px] tracking-[0.35em] uppercase font-medium hover:bg-black transition-colors duration-300"
              data-testid="admin-login-submit"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
