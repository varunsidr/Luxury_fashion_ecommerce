"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowUpRight, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        localStorage.setItem("admin_auth", "1");
        router.push("/admin/dashboard");
        return;
      }
      setError(response.status === 500 ? "Admin sign in is not configured. Check the server environment." : response.status === 429 ? "Too many attempts. Wait a moment and try again." : "That password didn’t match. Try again.");
      setPassword("");
    } catch {
      setError("Couldn’t reach the sign in service. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3] text-neutral-900 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#171715] px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-16">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.13]" style={{ backgroundImage: "radial-gradient(#d8c9ad 0.7px, transparent 0.7px)", backgroundSize: "19px 19px" }} />
        <div aria-hidden="true" className="absolute -bottom-32 -left-36 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 -left-20 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <Link href="/" className="relative w-fit text-sm tracking-[0.42em]">zeouf <span className="ml-2 text-[9px] tracking-[0.25em] text-white/45">LUXURY FASHION</span></Link>
        <div className="relative max-w-xl pb-8">
          <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-[#c5b18e]">The house, behind the scenes</p>
          <h1 className="font-playfair text-5xl font-light leading-[1.13] xl:text-6xl">Thoughtful tools<br />for a considered<br /><span className="italic text-[#c5b18e]">storefront.</span></h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-white/55">Manage your collection, inventory and customer orders in one calm workspace.</p>
        </div>
        <p className="relative text-[10px] tracking-[0.16em] text-white/35">ZEOUF ADMINISTRATION · PRIVATE ACCESS</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[410px]">
          <Link href="/" className="mb-16 inline-block text-xs tracking-[0.4em] text-neutral-900 lg:hidden">zeouf</Link>
          <div className="mb-10 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600"><LockKeyhole size={17} strokeWidth={1.5} /></div>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.36em] text-neutral-500">Admin sign in</p>
          <h2 className="font-playfair text-[38px] font-normal leading-tight">Welcome back.</h2>
          <p className="mt-2 text-sm text-neutral-500">Enter your password to open your workspace.</p>

          <form onSubmit={handleLogin} className="mt-10">
            <label htmlFor="admin-username" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">Username</label>
            <input id="admin-username" name="username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }} autoComplete="username" required className="mb-5 h-14 w-full border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900" data-testid="admin-login-username" />
            <label htmlFor="admin-password" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">Password</label>
            <div className="relative">
              <input id="admin-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="current-password" required autoFocus className="h-14 w-full border border-neutral-300 bg-white px-4 pr-12 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900" aria-invalid={!!error} aria-describedby={error ? "admin-login-error" : undefined} data-testid="admin-login-password" />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-neutral-400 transition hover:text-neutral-900">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            {error && <p id="admin-login-error" role="alert" className="mt-3 text-xs leading-5 text-red-700" data-testid="admin-login-error">{error}</p>}
            <button type="submit" disabled={!username || !password || submitting} className="mt-5 flex h-14 w-full items-center justify-center gap-3 bg-neutral-900 text-[10px] font-medium uppercase tracking-[0.32em] text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50" data-testid="admin-login-submit">
              {submitting ? <><LoaderCircle size={15} className="animate-spin" /> Signing in</> : <>Sign in <ArrowUpRight size={14} /></>}
            </button>
          </form>
          <div className="mt-8 flex items-center gap-2 text-[11px] text-neutral-500"><ShieldCheck size={14} strokeWidth={1.5} /><span>Secure access for store administrators</span></div>
          <p className="mt-16 text-[10px] tracking-wide text-neutral-400">Need help? Contact your store administrator.</p>
        </div>
      </section>
    </main>
  );
}
