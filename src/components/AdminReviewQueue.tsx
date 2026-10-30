"use client";

import { useEffect, useState } from "react";

type Review = { id: string; name?: string | null; rating: number; comment: string; created_at: string; approved: boolean; admin_reply?: string | null; displayImages?: string[] };

export default function AdminReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  function load() {
    return fetch("/api/admin/reviews?status=all", { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load reviews.");
        return result;
      })
      .then(result => setReviews(result.reviews ?? []))
      .catch(error => setError(error instanceof Error ? error.message : "Could not load reviews."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { void load(); }, []);

  async function change(id: string, update: { approved?: boolean; reply?: string | null } | "delete") {
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: update === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(update === "delete" ? {} : { body: JSON.stringify(update) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the review. Please retry.");
      setReviews(previous => update === "delete" ? previous.filter(review => review.id !== id) : previous.map(review => review.id === id ? result.review : review));
      if (update !== "delete" && "reply" in update) setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
      setDeleting(null);
      setNotice(update === "delete" ? "Review deleted." : "Review changes saved.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save the review. Please retry."); }
    finally { setBusy(null); }
  }

  const shown = reviews.filter(review => filter === "all" || review.approved === (filter === "approved"));
  const buttonClass = "min-h-11 border border-neutral-300 px-4 text-xs text-neutral-800 disabled:opacity-50";
  return <div className="p-5 md:p-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl font-light">Reviews</h1><p className="mt-2 text-xs text-neutral-600">Moderate and reply to the latest 200 reviews. Only approved reviews and their replies appear publicly.</p></div>
      <button onClick={() => { setLoading(true); setError(""); void load(); }} disabled={loading || busy !== null} className={buttonClass}>Refresh reviews</button>
    </div>
    <label className="text-sm">Review status <select value={filter} onChange={event => setFilter(event.target.value)} className="mb-6 ml-3 min-h-11 border border-neutral-300 px-3"><option value="pending">Pending</option><option value="approved">Approved</option><option value="all">All reviews</option></select></label>
    {error && <p role="alert" className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-5 text-sm text-neutral-700">{notice}</p>}
    {loading ? <p role="status">Loading reviews…</p> : <div className="space-y-4">{shown.length === 0 && <p className="border border-neutral-200 bg-white p-6 text-sm">No reviews in this view.</p>}{shown.map(review => <article key={review.id} aria-label={`Review by ${review.name ?? "Customer"}`} className="border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-medium">{review.name ?? "Customer"}</h2><p className="text-xs text-neutral-600">{review.rating}/5 · {review.approved ? "Approved" : "Pending"}</p></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{review.comment}</p>
      <p className="mt-3 text-xs text-neutral-600">{new Date(review.created_at).toLocaleDateString()}</p>
      {!!review.displayImages?.length && <div className="mt-4 flex flex-wrap gap-3">{review.displayImages.map((source, index) => <a key={index} href={source} target="_blank" rel="noreferrer" aria-label={`Open review attachment ${index + 1}`}><img src={source} alt={`Review attachment ${index + 1}`} width={96} height={96} className="h-24 w-24 object-cover" /></a>)}</div>}
      <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy !== null} onClick={() => change(review.id, { approved: !review.approved })} className={buttonClass}>{review.approved ? "Unpublish" : "Approve"}</button><button disabled={busy !== null} onClick={() => setDeleting(review.id)} className={buttonClass}>Delete review</button></div>
      {deleting === review.id && <div className="mt-4 border border-red-200 p-4"><p className="text-sm">Permanently delete this review? Its attachment files remain private in storage.</p><div className="mt-3 flex gap-3"><button disabled={busy !== null} onClick={() => change(review.id, "delete")} className={buttonClass}>Confirm deletion</button><button disabled={busy !== null} onClick={() => setDeleting(null)} className={buttonClass}>Keep review</button></div></div>}
      {review.admin_reply && <div className="mt-5 border-l-2 border-neutral-300 pl-4"><p className="text-xs font-medium">Current store reply</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.admin_reply}</p></div>}
      <form className="mt-5" onSubmit={event => { event.preventDefault(); void change(review.id, { reply: drafts[review.id] ?? review.admin_reply ?? "" }); }}>
        <label htmlFor={`reply-${review.id}`} className="block text-sm">Store reply</label><textarea id={`reply-${review.id}`} required maxLength={2000} rows={3} value={drafts[review.id] ?? review.admin_reply ?? ""} onChange={event => setDrafts(previous => ({ ...previous, [review.id]: event.target.value }))} className="mt-2 w-full border border-neutral-300 p-3 text-base focus:outline-neutral-800" />
        <div className="mt-3 flex flex-wrap gap-3"><button disabled={busy !== null} className={buttonClass}>{busy === review.id ? "Saving…" : "Save reply"}</button>{review.admin_reply && <button type="button" disabled={busy !== null} onClick={() => change(review.id, { reply: null })} className={buttonClass}>Remove reply</button>}</div>
      </form>
    </article>)}</div>}
  </div>;
}
