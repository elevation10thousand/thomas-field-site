// app/page.tsx
export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <TopNav /> 

        <Hero />

        <SalesBand />

        <TrustRow />

        <SectionLots />

        <RunwayFacts />

        <RunwayUsability />

        <SectionFeatures />

        <SectionPhotos />

        <SectionAbout />

        <SectionCTA />

        <Footer />
      </div>

      <StickyCtaBar />
    </main>
  );
}

/* ---------------- sections ---------------- */

function TopNav() {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-neutral-800 bg-neutral-900/50 grid place-items-center font-semibold">
          TF
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Thomas Field</div>
          <div className="text-xs text-neutral-400 leading-tight">
            Private airfield lots • Colorado
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <a
          href="/pilot"
          className="whitespace-nowrap rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm font-semibold hover:bg-neutral-900/70"
        >
          Pilot Login
        </a>

        <a
          href="/live"
          className="whitespace-nowrap rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm font-semibold hover:bg-neutral-900/70"
        >
          Live Weather
        </a>

        <a
          href="#lots-for-sale"
          className="whitespace-nowrap rounded-2xl bg-neutral-100 text-neutral-950 px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
        >
          Request Lot Packet →
        </a>
      </div>
    </div>
  );
}


/** Large hero photo + “LOTS FOR SALE” messaging */
function Hero() {
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/25">
      <div className="relative h-[480px] md:h-[610px]">
        {/* Use your mountains image across the page */}
        <img
          src="/photos/mountains.jpg"
          alt="Mountain flying near Thomas Field"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />

        {/* overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/92 via-neutral-950/55 to-neutral-950/12" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-neutral-950/30" />

        <div className="relative h-full max-w-6xl mx-auto px-5 py-10 flex items-end">
          <div className="w-full max-w-3xl">
            <div className="text-xs tracking-widest text-neutral-200/80">
              PRIVATE AIRFIELD • 7 LOTS AVAILABLE • 5 ACRES EACH
            </div>

            <h1 className="mt-3 text-4xl md:text-6xl font-semibold leading-tight">
              Thomas Field
              <span className="block text-neutral-200/90">
                Airfield Lots Available for Purchase Spring 2026
              </span>
            </h1>

            <p className="mt-4 text-neutral-200/85 text-base md:text-lg max-w-2xl">
              Seven <span className="text-neutral-100 font-semibold">5-acre</span> lots on a
              private Colorado airfield —{" "}
              <span className="text-neutral-100 font-semibold">Starting at $100,000</span>. Availabilty to purchase lot with pre-built hanger sized to your specs. Big
              views, wide-open space, and a pilot-first experience with live weather and runway
              guidance built in.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href="#interest"
                className="rounded-2xl bg-neutral-100 text-neutral-950 px-6 py-3 text-sm font-semibold hover:bg-neutral-200 text-center"
              >
                Request the Lot Packet →
              </a>

              <a
                href="/live"
                className="rounded-2xl border border-neutral-200/25 bg-neutral-950/35 px-6 py-3 text-sm font-semibold hover:bg-neutral-950/55 text-center"
              >
                View Live Weather
              </a>
            </div>

            <div className="mt-4 text-xs text-neutral-200/70">
              Live weather is public for pilot situational awareness.
            </div>
          </div>
        </div>
      </div>

      {/* under-hero strip */}
      <div className="px-5 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-300">
            Trust feature: live wind graphic + runway recommendation + altimeter + density altitude.
            Buyers can check conditions anytime.
          </div>
        </div>
      </div>
    </section>
  );
}

/** Big “sales band” removes any ambiguity */
function SalesBand() {
  return (
    <section className="mt-8">
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/25 p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-neutral-400">
              LOTS FOR SALE • 5 ACRES • $100,000
            </div>
            <div className="mt-2 text-xl md:text-2xl font-semibold">
              Want the map + lot packet?
            </div>
            <div className="mt-1 text-sm text-neutral-300 max-w-2xl">
              We’ll send lot layout, availability, access notes, and next steps.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#interest"
              className="rounded-2xl bg-neutral-100 text-neutral-950 px-6 py-3 text-sm font-semibold hover:bg-neutral-200 text-center"
            >
              Request Lot Packet →
            </a>
            <a
              href="/live"
              className="rounded-2xl border border-neutral-800 bg-neutral-950/40 px-6 py-3 text-sm font-semibold hover:bg-neutral-900/50 text-center"
            >
              Check Live Weather
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustRow() {
  return (
    <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Pill title="5-acre lots" body="Seven lots. Room for cabin + hangar + shop concepts." />
      <Pill title="Starting at $100,000" body="Simple and clear pricing — no games." />
      <Pill title="Live runway data" body="A real pilot tool that adds credibility to the project." />
    </section>
  );
}

function SectionLots() {
  return (
    <section className="mt-12" id="lots-for-sale">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold">Lots for sale</h2>
          <p className="mt-2 text-neutral-300 max-w-3xl">
            Seven private airfield-adjacent lots —{" "}
            <span className="text-neutral-100 font-semibold">5 acres</span> each —{" "}
            <span className="text-neutral-100 font-semibold"> Starting at $100,000</span> per lot.
            Request the lot packet for the map and availability.
          </p>
        </div>

        <a
          href="#interest"
          className="rounded-2xl bg-neutral-100 text-neutral-950 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-200"
        >
          Get the packet →
        </a>
      </div>

      {/* Parcel map placeholder */}
<div className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
  <div className="p-5 md:p-6 flex items-start justify-between gap-4 flex-wrap">
    <div>
      <div className="text-sm font-semibold">Parcel map (lots 1–7)</div>
      <div className="mt-1 text-sm text-neutral-300">
        Placeholder — we’ll drop in the official parcel map / lot layout image here.
      </div>
    </div>

    <a
      href="#interest"
      className="rounded-2xl bg-neutral-100 text-neutral-950 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-200"
    >
      Request the lot packet →
    </a>
  </div>

  {/* Big map frame */}
  <div className="px-5 md:px-6 pb-6">
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 h-[360px] md:h-[520px] grid place-items-center">
      <div className="text-center px-6">
        <div className="text-xs tracking-widest text-neutral-400 uppercase">Parcel Map Placeholder</div>
        <div className="mt-2 text-neutral-200 font-semibold">Lot layout image goes here</div>
        <div className="mt-2 text-sm text-neutral-400">
          (Upload your map into <span className="font-mono">/public</span> and we’ll display it.)
        </div>
      </div>
    </div>

    {/* Status legend */}
    <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          <span className="text-neutral-300">Available</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
          <span className="text-neutral-300">Limited</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-500" />
          <span className="text-neutral-300">Waitlist</span>
        </span>
      </div>

      <div className="text-xs text-neutral-500">
        Final boundaries/labels shown in the lot packet.
      </div>
    </div>
  </div>
</div>


      <div
        className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/25 p-6 md:p-7"
        id="interest"
      >
        <div className="text-sm font-semibold">Request the lot packet</div>
        <div className="text-sm text-neutral-300 mt-1">
          Includes lot map, airfield details, access notes, and next steps.
        </div>

        <form className="mt-4 flex flex-col sm:flex-row gap-3" action="/api/lead" method="post">
          <input
            className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-sm outline-none focus:border-neutral-600"
            placeholder="Email"
            type="email"
            required
            name="email"
          />
          <button
            className="rounded-2xl bg-neutral-100 text-neutral-950 px-5 py-3 text-sm font-semibold hover:bg-neutral-200"
            type="submit"
          >
            Send me the packet
          </button>
        </form>

        <div className="mt-2 text-xs text-neutral-500">
          No spam. Lot-specific information only.
        </div>
      </div>

      {/* Placeholder for your “Eventually 1,2,3” items */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Pill title="Lot map (coming next)" body="We’ll add a numbered lot map image with overlays." />
        <Pill title="What you can build" body="We’ll add clear build/use notes: cabin, hangar, shop concepts." />
        <Pill title="How buying works" body="We’ll add a simple step-by-step process and timeline." />
      </div>
    </section>
  );
}

function RunwayFacts() {
  return (
    <section className="mt-12 rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Airfield quick facts</h2>
          <div className="text-sm text-neutral-300 mt-1">
            Update placeholders as you finalize details.
          </div>
        </div>
        <a
          href="/live"
          className="text-sm font-semibold text-neutral-200 hover:text-neutral-100 underline underline-offset-4"
        >
          View live airfield conditions →
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Fact label="Runway" value="09 / 27" />
        <Fact label="Elevation" value="9,300 ft" />
        <Fact label="Length" value="5,000 ft" />
        <Fact label="Surface" value="Dirt" />
        <Fact label="Use" value="Private" />
      </div>
    </section>
  );
}
        function RunwayUsability() {
  return (
    <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Runway usability</h2>
          <div className="text-sm text-neutral-300 mt-1">
            Quick access to live runway components, recommended runway, gust spread, and trends.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/pilot"
            className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm font-semibold hover:bg-neutral-900/70"
          >
            Pilot Login
          </a>

          <a
            href="/live"
            className="rounded-2xl bg-neutral-100 text-neutral-950 px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
          >
            View Stats →
          </a>
        </div>
      </div>

      {/* Clickable Graphic Card */}
      <a
        href="/live"
        className="group mt-5 block rounded-3xl border border-neutral-800 bg-neutral-950/35 p-5 hover:bg-neutral-950/55"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="min-w-0">
            <div className="text-xs tracking-widest text-neutral-400 uppercase">
              Click to open the stats page
            </div>
            <div className="mt-2 text-lg md:text-xl font-semibold text-neutral-100">
              Live runway recommendation + wind components
            </div>
            <div className="mt-2 text-sm text-neutral-300 max-w-2xl">
              Built for pilots: headwind/crosswind for 09/27, gusts, variability, altimeter, density altitude,
              and a clear stale-data warning.
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-neutral-300">
                RWY 09/27
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-neutral-300">
                HW/XW components
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-neutral-300">
                Gust spread
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-neutral-300">
                Altimeter & DA
              </span>
            </div>
          </div>

          {/* Graphic placeholder (swap with your runway/wind SVG later) */}
          <div className="shrink-0">
            <div className="relative h-28 w-full md:w-[360px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
              {/* subtle “instrument” lines */}
              <div className="absolute inset-0 opacity-70">
                <div className="absolute left-5 top-6 h-2 w-56 rounded bg-neutral-800" />
                <div className="absolute left-5 top-12 h-2 w-64 rounded bg-neutral-800" />
                <div className="absolute left-5 top-18 h-2 w-44 rounded bg-neutral-800" />
              </div>

              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center px-4">
                  <div className="text-xs text-neutral-400">Runway Usability Graphic</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-200">
                    (Click to open Stats)
                  </div>
                </div>
              </div>

              <div className="absolute inset-0 ring-1 ring-inset ring-white/0 group-hover:ring-white/10" />
            </div>
          </div>
        </div>
      </a>
    </section>
  );
}

function SectionFeatures() {
  return (
    <section className="mt-12">
      <h2 className="text-2xl md:text-3xl font-semibold">
        Live weather (built for pilots)
      </h2>
      <p className="mt-2 text-neutral-300 max-w-3xl">
        This is a real pilot tool and a trust feature for the airfield lots.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Feature
          title="Pilot wind graphic"
          body='Primary wind direction, gusts, and optional “variable” wedge when spread/flag indicates variability.'
        />
        <Feature
          title="Runway components"
          body="Headwind/crosswind components for RWY 09 and RWY 27, plus a recommended runway."
        />
        <Feature
          title="Altimeter + density altitude"
          body="Two of the most important numbers for mountain flying."
        />
        <Feature
          title="Stale-data warning"
          body="Clear warning if the last update is older than 5 minutes (configurable)."
        />
      </div>
    </section>
  );
}

function SectionPhotos() {
  return (
    <section className="mt-12" id="lots">
      <h2 className="text-2xl md:text-3xl font-semibold">Photo highlights</h2>
      <p className="mt-2 text-neutral-300 max-w-2xl">
        A taste of the scenery and backcountry flying culture around the airfield.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <PhotoCard
          title="Runway"
          subtitle="Backcountry access, easy staging, and room to build."
          src="/photos/runway.jpg"
        />
        <PhotoCard
          title="Mountain flying"
          subtitle="Big views and unforgettable routes. The Gateway to Colorado's Best Flying"
          src="/photos/mountains.jpg"
        />
        <PhotoCard
          title="Backcountry vibe"
          subtitle="Built for pilots who want space and freedom."
          src="/photos/bushplane.jpg"
        />
      </div>
    </section>
  );
}

function SectionAbout() {
  return (
    <section className="mt-12">
      <h2 className="text-2xl md:text-3xl font-semibold">About Us</h2>
      <p className="mt-2 text-neutral-300 max-w-3xl">
        Thomas Field is a private, pilot-built mountain airfield designed for those who value freedom, precision, and backcountry aviation at its best. Set high in Colorado’s Front Range, we combine thoughtful runway design, real-time weather intelligence, and a tight-knit aviation community to create a place where pilots don’t just land—they belong.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Pill title="Location" body="45 Minutes to Breckenridge --
        12 Minutes to the Historic town of Fairplay --
        30 Minutes to Buena Vista" />
        <Pill title="Usability" body="Year round Use with Aircraft usability statistics" />
        <Pill title="Future-ready" body="Alerts, history charts, and per-aircraft limits next." />
      </div>
    </section>
  );
}

function SectionCTA() {
  return (
    <section className="mt-12 rounded-3xl border border-neutral-800 bg-neutral-900/25 p-6 md:p-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold">Request the lot packet</h2>
          <p className="mt-2 text-neutral-300 max-w-xl">
            Maps, lot availability, airfield details, and next steps.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
          <a
            href="#interest"
            className="rounded-2xl bg-neutral-100 text-neutral-950 px-6 py-3 text-sm font-semibold hover:bg-neutral-200 text-center"
          >
            Request Lot Packet →
          </a>
          <a
            href="/live"
            className="rounded-2xl border border-neutral-700 bg-neutral-950/40 px-6 py-3 text-sm font-semibold hover:bg-neutral-900/50 text-center"
          >
            Check Live Weather
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-12 pb-10 text-xs text-neutral-500 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
      <div>© {new Date().getFullYear()} Thomas Field</div>
      <div className="text-neutral-600">
        Private property / private operations. Always verify conditions before flight.
      </div>
    </footer>
  );
}

/* ---------------- sticky CTA bar ---------------- */

function StickyCtaBar() {
  return (
    <div className="fixed bottom-4 left-0 right-0 px-4 pointer-events-none">
      <div className="max-w-6xl mx-auto pointer-events-auto">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-200">
            <span className="font-semibold">Lots for sale</span>{" "}
            <span className="text-neutral-400">— 5 acres — $100,000</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/live"
              className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm font-semibold hover:bg-neutral-900/70"
            >
              Live Weather
            </a>
            <a
              href="#interest"
              className="rounded-2xl bg-neutral-100 text-neutral-950 px-4 py-2 text-sm font-semibold hover:bg-neutral-200"
            >
              Lot Packet →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small components ---------------- */

function Pill({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/25 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-neutral-300">{body}</div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/25 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm text-neutral-300">{body}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/25 p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

function PhotoCard({
  title,
  subtitle,
  src,
}: {
  title: string;
  subtitle: string;
  src: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
      <div className="aspect-[16/10] bg-neutral-950/60">
        <img src={src} alt={title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-5">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-sm text-neutral-300">{subtitle}</div>
      </div>
    </div>
  );
}

function LotCard({
  title,
  acres,
  price,
  status,
}: {
  title: string;
  acres: string;
  price: string;
  status: "Available" | "Limited" | "Waitlist";
}) {
  const statusColor =
    status === "Available"
      ? "text-emerald-300"
      : status === "Limited"
      ? "text-amber-300"
      : "text-neutral-400";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/25 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-sm text-neutral-300">{acres}</div>
          <div className="mt-2 text-lg font-semibold text-neutral-100">{price}</div>
        </div>
        <div className={`text-xs font-semibold ${statusColor}`}>{status}</div>
      </div>

      <div className="mt-4">
        <a
          href="#interest"
          className="inline-block text-sm font-semibold text-neutral-100 hover:underline underline-offset-4"
        >
          Request details →
        </a>
      </div>
    </div>
  );
}


