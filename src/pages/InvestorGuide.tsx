import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Investor Guide — Polished UI (Drop‑in React Page)
 * -------------------------------------------------
 * Copy this file to:
 *   - Next.js (App Router): app/investors/page.tsx  (export default function Page())
 *   - Next.js (Pages Router): pages/investors.tsx
 *   - Vite/CRA: any route component
 *
 * No external UI dependencies required (Tailwind CSS recommended).
 * Works without Tailwind too, but looks best with it.
 *
 * How to customize quickly:
 * 1) Fill the `content` object with your existing investor info.
 * 2) Set `contactEmail`, `deckUrl`, and `onePagerUrl`.
 * 3) (Optional) Replace placeholder logo URLs and hero image.
 * 4) Drop in product screenshots for the gallery.
 */

// ---------------------- CONTENT (EDIT THIS PART) ---------------------- //
const contactEmail = "invest@yourdomain.com"; // ← change
const deckUrl = "/deck.pdf";                  // ← link to your deck (or Google Drive)
const onePagerUrl = "/one-pager.pdf";         // ← link to your one pager

const content = {
  company: {
    name: "TW Ventures",
    tagline: "Operational OS for client–admin collaboration.",
    lastUpdated: new Date().toISOString().slice(0, 10),
    heroImage: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1600&q=80&auto=format&fit=crop",
    highlights: [
      { label: "Active Workspaces", value: "312" },
      { label: "Quarterly GMV" , value: "$1.8M" },
      { label: "Net Dollar Retention", value: "129%" },
      { label: "Gross Margin", value: "84%" },
    ],
  },
  problem: {
    title: "The problem",
    bullets: [
      "Service businesses juggle quotes, messages, files, and invoices across 6+ tools.",
      "Clients get lost; admins chase status in email and spreadsheets.",
      "Missed handoffs create rework, delays, and lost revenue.",
    ],
  },
  solution: {
    title: "Our solution",
    bullets: [
      "Unified client & admin portal with phases, files, chat, and billing.",
      "Real‑time updates, role‑based permissions, and audit trail by default.",
      "API‑first architecture (Supabase) + plug‑and‑play modules (maps, invoicing, reports).",
    ],
  },
  market: {
    title: "Market",
    text: "Horizontal: professional services SMBs in North America & EU. Beachhead: GPR & windows services with field ops.",
    metrics: [
      { label: "Service SMB TAM", value: "$50B+" },
      { label: "SAM (initial)", value: "$3.2B" },
      { label: "SOM (5yr)", value: "$280M" },
    ],
  },
  traction: {
    title: "Traction",
    bullets: [
      "12 design partners live; 3 paying pilots converting to annual.",
      "< 2 week onboarding to first value; 40% faster cycle time.",
      "Integrations: Stripe, Supabase, Keila, Google Maps.",
    ],
  },
  businessModel: {
    title: "Business model",
    bullets: [
      "SaaS per workspace + usage (documents, storage, seats).",
      "Payments take rate on invoices paid through platform.",
      "Add‑ons: lead gen module, reporting, SSO.",
    ],
  },
  moat: {
    title: "Why we win",
    bullets: [
      "Deep workflows for regulated / field ops (GPR, construction).",
      "Data network effects on quotes → benchmarks.",
      "Speed of iteration via modular Supabase + TypeScript stack.",
    ],
  },
  roadmap: {
    title: "Roadmap",
    items: [
      { when: "Q3 2025", what: "Billing v2 (Customer Portal), Discord role sync, Metrics dashboard" },
      { when: "Q4 2025", what: "Mobile field app (offline), Lead Gen module GA" },
      { when: "Q1 2026", what: "Template marketplace, Partner API" },
    ],
  },
  team: {
    title: "Team",
    members: [
      { name: "R. Moodie", role: "Founder & CEO", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&q=80&auto=format&fit=crop" },
      { name: "A. Patel", role: "Founding Engineer", img: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=256&q=80&auto=format&fit=crop" },
      { name: "J. Kim", role: "Design Lead", img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=256&q=80&auto=format&fit=crop" },
    ],
  },
  gallery: {
    title: "Product visuals",
    images: [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1280&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1280&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1280&q=80&auto=format&fit=crop",
    ],
  },
  faq: {
    title: "FAQ",
    items: [
      { q: "What's your go‑to‑market?", a: "Direct founder‑led sales into service SMBs; expand via partner installers and industry associations." },
      { q: "How do you price?", a: "Per workspace + usage tiers. Annual preferred with 2 months free." },
      { q: "What are the next milestones?", a: "10 paying customers, $25k MRR, mobile field app beta." },
    ],
  },
  disclaimers: "Forward‑looking statements. Not an offer to sell securities.",
};
// ---------------------- END CONTENT ---------------------- //

// Utility — classnames
function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

// Hook — scroll spy for section highlighting
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(id);
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: [0, 1] }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [ids.join(",")]);
  return active;
}

// Small components
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-sm font-medium text-black/70 dark:bg-white/10 dark:text-white/80">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-black/60 dark:text-white/70">{label}</div>
    </div>
  );
}

function Section({ id, title, children, eyebrow }: { id: string; title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6">
        {eyebrow && <div className="text-xs uppercase tracking-widest text-black/50 dark:text-white/60">{eyebrow}</div>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

function CTAButtons() {
  const share = async () => {
    const data = { title: `${content.company.name} — Investor Guide`, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // User dismissed the share sheet — not an error.
      }
    } else {
      await navigator.clipboard.writeText(data.url);
      alert("Link copied to clipboard");
    }
  };
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <a href={`mailto:${contactEmail}`} className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-white hover:opacity-90 dark:bg-white dark:text-black">Contact</a>
      <a href={deckUrl} target="_blank" className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:bg-neutral-950 dark:hover:bg-white/10">View Deck</a>
      <a href={onePagerUrl} target="_blank" className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:bg-neutral-950 dark:hover:bg-white/10">One‑pager</a>
      <button onClick={() => window.print()} className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:bg-neutral-950 dark:hover:bg-white/10">Download PDF</button>
      <button onClick={share} className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:bg-neutral-950 dark:hover:bg-white/10">Share</button>
    </div>
  );
}

function Gallery({ images }: { images: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {images.map((src, i) => (
        <img key={i} src={src} alt="Product screenshot" className="aspect-video w-full rounded-2xl object-cover shadow" />
      ))}
    </div>
  );
}

function Timeline({ items }: { items: { when: string; what: string }[] }) {
  return (
    <ol className="relative ml-3 border-l border-black/10 dark:border-white/10">
      {items.map((it, idx) => (
        <li key={idx} className="mb-6 ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-black dark:bg-white" />
          <time className="text-xs uppercase tracking-widest text-black/50 dark:text-white/60">{it.when}</time>
          <div className="mt-1 text-sm md:text-base">{it.what}</div>
        </li>
      ))}
    </ol>
  );
}

function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-neutral-950">
      {items.map((f, i) => (
        <details key={i} open={open === i} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? i : null)} className="p-4">
          <summary className="cursor-pointer list-none text-base font-medium">{f.q}</summary>
          <p className="mt-2 text-black/70 dark:text-white/70">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

function TOC({ sections, active }: { sections: { id: string; label: string }[]; active: string }) {
  return (
    <nav className="sticky top-24 hidden h-max w-64 shrink-0 lg:block print:hidden">
      <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-neutral-950">
        <div className="mb-2 text-xs uppercase tracking-widest text-black/50 dark:text-white/60">On this page</div>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={cn("block rounded px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10", active === s.id && "bg-black text-white dark:bg-white dark:text-black")}>{s.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function Header() {
  return (
    <header className="relative overflow-hidden rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <Pill>Investor guide</Pill>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">{content.company.name}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{content.company.tagline}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Last updated: {content.company.lastUpdated}</span>
          </div>
        </div>
        <CTAButtons />
      </div>
      {content.company.heroImage && (
        <img src={content.company.heroImage} alt="Hero" className="pointer-events-none absolute right-6 top-6 hidden w-48 rounded-2xl opacity-80 shadow-2xl md:block" />
      )}
    </header>
  );
}

export default function InvestorGuidePage() {
  const sections = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "problem", label: "Problem" },
      { id: "solution", label: "Solution" },
      { id: "market", label: "Market" },
      { id: "traction", label: "Traction" },
      { id: "business", label: "Business model" },
      { id: "moat", label: "Why we win" },
      { id: "roadmap", label: "Roadmap" },
      { id: "team", label: "Team" },
      { id: "gallery", label: "Product visuals" },
      { id: "faq", label: "FAQ" },
    ],
    []
  );
  const active = useScrollSpy(sections.map((s) => s.id));

  return (
    <main className="mx-auto max-w-7xl gap-8 px-4 py-8 md:px-6 lg:grid lg:grid-cols-[1fr_280px]">
      <div className="space-y-12">
        <Header />

        <section className="grid gap-4 md:grid-cols-4">
          {content.company.highlights.map((h, i) => (
            <Stat key={i} {...h} />
          ))}
        </section>

        <Section id="overview" title="Overview">
          <div className="prose max-w-none dark:prose-invert">
            <p><strong>{content.company.name}</strong> is an operational OS bringing clients and admins into one streamlined workflow — proposals, phases, files, chat, and billing in a single place. This investor snapshot summarizes market, traction, and near‑term milestones.</p>
          </div>
        </Section>

        <Section id="problem" title={content.problem.title}>
          <ul className="grid list-disc gap-2 pl-5 text-black/80 dark:text-white/80">
            {content.problem.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>

        <Section id="solution" title={content.solution.title}>
          <ul className="grid list-disc gap-2 pl-5 text-black/80 dark:text-white/80">
            {content.solution.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>

        <Section id="market" title={content.market.title}>
          <div className="prose max-w-none dark:prose-invert">
            <p>{content.market.text}</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {content.market.metrics.map((m, i) => (
              <Stat key={i} {...m} />
            ))}
          </div>
        </Section>

        <Section id="traction" title={content.traction.title}>
          <ul className="grid list-disc gap-2 pl-5 text-black/80 dark:text-white/80">
            {content.traction.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>

        <Section id="business" title={content.businessModel.title}>
          <ul className="grid list-disc gap-2 pl-5 text-black/80 dark:text-white/80">
            {content.businessModel.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>

        <Section id="moat" title={content.moat.title}>
          <ul className="grid list-disc gap-2 pl-5 text-black/80 dark:text-white/80">
            {content.moat.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>

        <Section id="roadmap" title={content.roadmap.title}>
          <Timeline items={content.roadmap.items} />
        </Section>

        <Section id="team" title={content.team.title}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {content.team.members.map((m, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-950">
                <img src={m.img} alt={m.name} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-sm text-black/60 dark:text-white/70">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="gallery" title={content.gallery.title}>
          <Gallery images={content.gallery.images} />
        </Section>

        <Section id="faq" title={content.faq.title}>
          <FAQ items={content.faq.items} />
        </Section>

        <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60 dark:border-white/10 dark:bg-neutral-950 dark:text-white/60">
          {content.disclaimers}
        </div>
      </div>

      <TOC sections={sections} active={active} />
    </main>
  );
}
