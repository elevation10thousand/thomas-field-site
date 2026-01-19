// app/pilot/page.tsx

export default function PilotLoginPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-5 py-10">
      <div className="max-w-md mx-auto">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/25 p-6">
          <h1 className="text-2xl font-semibold">Pilot Login</h1>

          <p className="mt-2 text-sm text-neutral-300">
            Pilot-only access. Authentication coming next.
          </p>

          {/* Temporary login behavior: submit redirects to /live */}
          <form
            className="mt-6 space-y-4"
            action="/live"
            method="get"
          >
            <div>
              <label className="text-sm text-neutral-300">Email</label>
              <input
                type="email"
                name="email"
                required
                placeholder="pilot@domain.com"
                className="mt-1 w-full rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-sm outline-none focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="text-sm text-neutral-300">Password</label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="mt-1 w-full rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-sm outline-none focus:border-neutral-600"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-neutral-100 text-neutral-950 px-5 py-3 text-sm font-semibold hover:bg-neutral-200"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-xs text-neutral-500">
            Private property • Private operations • Always verify conditions before flight
          </div>

          <div className="mt-4 text-xs">
            <a
              href="/"
              className="text-neutral-400 hover:text-neutral-200 underline underline-offset-4"
            >
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
