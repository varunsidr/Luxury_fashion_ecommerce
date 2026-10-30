"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export default function AdminDialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={heading} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto border border-neutral-200 bg-white p-5 text-neutral-800 backdrop:bg-black/40 md:p-7">
    <div className="mb-6 flex items-center justify-between gap-4"><h2 id={heading} className="text-lg font-medium">{title}</h2><button type="button" onClick={onClose} className="min-h-11 px-3 text-sm">Close</button></div>
    {children}
  </dialog>;
}
