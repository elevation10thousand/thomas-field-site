export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-neutral-800 bg-neutral-900/30 p-8 text-center">
        <div className="text-sm tracking-widest text-neutral-400">
          REQUEST RECEIVED
        </div>

        <h1 className="mt-3 text-3xl font-semibold">
          You’re on the list
        </h1>

        <p className="mt-3 text-neutral-300">
          Thanks for your interest in the Thomas Field airfield lots.
          We’ll follow up with the lot packet and next steps shortly.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/"
            className="rounded-2xl bg-neutral-100 text-neutral-950 px-6 py-3 text-sm font-semibold hover:bg-neutral-200"
          >
            ← Back to home
          </a>

          <a
            href="/live"
            className="rounded-2xl border border-neutral-700 bg-neutral-950/40 px-6 py-3 text-sm font-semibold hover:bg-neutral-900/60"
          >
            View live weather
          </a>
        </div>

        <div className="mt-6 text-xs text-neutral-500">
          No spam. Lot-specific information only.
        </div>
      </div>
    </main>
  );
}
