import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 pb-24 pt-32">
      <article className="mx-auto max-w-2xl">
        <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-neutral-400">Demo information</p>
        <h1 className="mb-8 font-playfair text-4xl font-light text-neutral-900">Privacy notice</h1>
        <p className="mb-10 border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-700">
          zeouf is a portfolio demonstration, not an operating shop. Please use fictional details and do not submit sensitive or real delivery information.
        </p>

        <div className="space-y-8 text-sm font-light leading-relaxed text-neutral-600">
          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-900">What the demo stores</h2>
            <p>
              If the demo database is enabled, signing in, placing a demo order, writing a review, saving favorites, or requesting a restock alert can store the information you enter in the configured Supabase project. Demo orders can update demo inventory. The cart is also saved in this browser.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-900">Payments and delivery</h2>
            <p>
              Checkout simulates a successful card payment or cash on delivery. It does not collect card details, charge money, arrange shipment, accept returns or provide customer support follow-up. Use fictional contact and address details because submitted demo orders can be stored.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-900">Email features</h2>
            <p>
              The newsletter form is a visual preview and does not currently subscribe or send email. Restock alert requests may be saved in the demo database; email delivery depends on server configuration.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-900">Demo data</h2>
            <p>
              This notice describes the current demonstration behavior. Do not rely on it as a commercial privacy policy. For project questions, contact the maintainer through <a className="underline underline-offset-4" href="https://github.com/varunsidr" target="_blank" rel="noreferrer">GitHub</a>.
            </p>
          </section>
        </div>
        <Link href="/" className="mt-12 inline-block text-[10px] uppercase tracking-[0.25em] text-neutral-500 underline underline-offset-4">Back to store</Link>
      </article>
    </div>
  );
}
