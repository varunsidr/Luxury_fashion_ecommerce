"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function PasswordRecovery() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "saved">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        if (!isSupabaseConfigured) throw new Error("Password recovery is unavailable until the store connection is configured.");
        const recoveryError = new URLSearchParams(window.location.hash.slice(1)).get("error") || new URLSearchParams(window.location.search).get("error");
        if (recoveryError) {
          window.history.replaceState(null, "", window.location.pathname);
          throw new Error("This recovery link is invalid or has expired. Request a new link below.");
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("This recovery link is invalid or has expired. Request a new link below.");
        if (active) setState("ready");
      } catch (error) {
        if (active) { setError(error instanceof Error ? error.message : "Could not verify your recovery link."); setState("invalid"); }
      }
    }
    void checkSession();
    return () => { active = false; };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmation(""); setState("saved");
      try {
        const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
        if (logoutError) throw logoutError;
      } catch { setNotice("Your password was updated. Sign out of this browser before signing in again."); }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update your password. Please try again."); }
    finally { setBusy(false); }
  }

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    try {
      if (!isSupabaseConfigured) throw new Error("Password recovery is unavailable until the store connection is configured.");
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setNotice("If an account exists for this address, you’ll receive a recovery link. Check your inbox and spam folder.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not request a recovery link. Please try again."); }
    finally { setBusy(false); }
  }

  const inputClass = "mt-2 min-h-12 w-full border border-neutral-300 px-3 text-base outline-none focus:border-neutral-800";
  return (
    <div className="min-h-screen px-6 pb-24 pt-40">
      <section className="mx-auto max-w-md" aria-labelledby="recovery-title">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Your account</p>
        <h1 id="recovery-title" className="mt-3 font-playfair text-3xl">Reset your password</h1>
        {state === "checking" && <p role="status" className="mt-6">Checking your recovery link…</p>}
        {error && <p role="alert" className="mt-6 border border-red-200 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-6 text-sm leading-6 text-neutral-700">{notice}</p>}
        {state === "saved" && <div className="mt-6"><p role="status">Your password has been updated. You can sign in with your new password.</p><Link href="/" className="mt-6 inline-block border-b border-neutral-800 py-3">Return to the store to sign in</Link></div>}
        {state === "ready" && <form onSubmit={updatePassword} className="mt-8 space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Choose a new password with at least 8 characters. Your account’s password policy may require more.</p>
          <label className="block text-sm">New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} /></label>
          <label className="block text-sm">Confirm new password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} className={inputClass} /></label>
          <button disabled={busy} className="min-h-12 w-full bg-neutral-900 px-5 text-sm text-white disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>
        </form>}
        {state === "invalid" && <form onSubmit={requestLink} className="mt-8 space-y-5">
          <label className="block text-sm">Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className={inputClass} /></label>
          <button disabled={busy || !isSupabaseConfigured} className="min-h-12 w-full bg-neutral-900 px-5 text-sm text-white disabled:opacity-50">{busy ? "Sending…" : "Send a new recovery link"}</button>
        </form>}
      </section>
    </div>
  );
}
