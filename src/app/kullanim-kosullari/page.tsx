import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white pt-32 pb-24">
      <div className="max-w-2xl mx-auto px-6">
        <p className="text-[10px] tracking-[0.45em] text-neutral-400 uppercase mb-4">Legal</p>
        <h1 className="text-[36px] font-light font-playfair text-neutral-900 mb-12 leading-tight">
          Terms of Service
        </h1>

        <div className="space-y-10 text-[14px] text-neutral-500 font-light leading-relaxed">
          <section>
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-neutral-800 mb-3">1. Open Source Project</h2>
            <p>
              This platform is an open-source project. The source code is available at
              <a
                href="https://github.com/varunsidr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition-colors"
              >
                github.com/varunsidr
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-neutral-800 mb-3">2. Copyright</h2>
            <p>
              This project was designed and developed by <strong className="text-neutral-700 font-medium">Elif Kaynar</strong>.
              All design, code and content rights are reserved. Please obtain written permission before reusing, copying or distributing.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-neutral-800 mb-3">3. Permission</h2>
            <p>
              If you want to use this project for commercial or personal purposes, please contact via
              <a
                href="https://github.com/varunsidr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition-colors"
              >
                GitHub
              </a>. Unauthorized use may have legal consequences.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-neutral-800 mb-3">4. Disclaimer</h2>
            <p>
              The platform is developed for educational and portfolio purposes. It is not a production-ready e-commerce platform.
              No liability is assumed for potential bugs or data loss.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-neutral-800 mb-3">5. Changes</h2>
            <p>
              These terms may be changed without notice. The current terms are always published on this page.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-10 border-t border-neutral-100 flex items-center justify-between">
          <p className="text-[11px] text-neutral-400">© 2026 EL&apos;S — Elif Kaynar</p>
          <Link
            href="/"
            className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 hover:text-neutral-800 transition-colors duration-300"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
