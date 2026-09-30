import Link from "next/link";
import { ReactNode } from "react";
import { getAppName, footerNav } from "@/content/site";
import { landing } from "@/content/landing";

const appName = getAppName();

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      {description ? <p className="mt-3 text-slate-600">{description}</p> : null}
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">
      <div className="mb-4 inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-600">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-6 shadow-card">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-600">{step}</span>
      <h3 className="mt-2 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3 text-sm text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-600">
            <CheckIcon />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function LandingPage() {
  const c = landing;
  return (
    <div className="bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt={`${appName} logo`} className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">{appName}</span>
          </div>
          <nav aria-label="Site" className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              {c.header.signIn}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              {c.header.getStarted}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              {c.hero.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              {c.hero.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{c.hero.subtitle}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="w-full rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:w-auto"
              >
                {c.hero.primaryCta}
              </Link>
              <a
                href="#preview"
                className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:w-auto"
              >
                {c.hero.secondaryCta}
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">{c.hero.note}</p>
          </div>

          {/* Product preview */}
          <div id="preview" className="mx-auto mt-14 max-w-5xl scroll-mt-24">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-slate-300" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-slate-300" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-slate-300" aria-hidden="true" />
                <span className="ml-3 text-xs text-slate-500">{c.hero.previewCaption}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3">
                <div className="hidden border-r border-slate-200 p-4 md:block">
                  <div className="space-y-2" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="rounded border border-slate-200 p-2">
                        <div className="h-2 w-10 rounded bg-slate-200" />
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 rounded bg-slate-100" />
                          <div className="h-1.5 w-4/5 rounded bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-3" aria-hidden="true">
                    <div className="h-2.5 w-2/3 rounded bg-slate-200" />
                    <div className="h-2 rounded bg-slate-100" />
                    <div className="h-2 rounded bg-yellow-200/70" />
                    <div className="h-2 w-5/6 rounded bg-slate-100" />
                    <div className="h-2 rounded bg-slate-100" />
                    <div className="h-2 w-3/4 rounded bg-yellow-200/70" />
                    <div className="h-2 rounded bg-slate-100" />
                    <div className="h-2 w-1/2 rounded bg-slate-100" />
                  </div>
                  <p className="mt-4 text-xs text-slate-500">{c.hero.previewNote}</p>
                </div>
                <div className="border-t border-slate-200 bg-slate-50 p-4 md:border-l md:border-t-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {c.hero.previewPanelTitle}
                  </p>
                  <div className="mt-3 space-y-2 text-sm" aria-hidden="true">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="h-2 w-16 rounded bg-slate-200" />
                      <div className="mt-2 h-1.5 rounded bg-slate-100" />
                      <div className="mt-1 h-1.5 w-3/4 rounded bg-slate-100" />
                    </div>
                    <div className="rounded-lg border border-brand-200 bg-white p-3 ring-1 ring-brand-600">
                      <div className="h-2 w-16 rounded bg-brand-100" />
                      <div className="mt-2 h-1.5 rounded bg-slate-100" />
                      <div className="mt-1 h-1.5 w-2/3 rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow={c.howItWorks.eyebrow}
          title={c.howItWorks.title}
          description={c.howItWorks.description}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {c.howItWorks.steps.map((s) => (
            <StepCard key={s.title} step={s.step} title={s.title} description={s.description} />
          ))}
        </div>
      </section>

      {/* Key features */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow={c.features.eyebrow} title={c.features.title} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.items.map((f) => (
              <FeatureCard key={f.title} title={f.title} description={f.description} icon={<CheckIcon />} />
            ))}
          </div>
        </div>
      </section>

      {/* Document review workflow */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow={c.workflow.eyebrow}
          title={c.workflow.title}
          description={c.workflow.description}
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{c.workflow.reviewWorkspace.title}</h3>
            <BulletList items={c.workflow.reviewWorkspace.bullets} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{c.workflow.writingAssistant.title}</h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              {c.workflow.writingAssistant.intro}
            </p>
            <BulletList items={c.workflow.writingAssistant.bullets} />
          </div>
        </div>
      </section>

      {/* Security and privacy */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow={c.security.eyebrow} title={c.security.title} />
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
            {c.security.items.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link
              href="/privacy"
              className="font-medium text-brand-700 underline hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              {c.security.privacyLink}
            </Link>
          </p>
        </div>
      </section>

      {/* Supported file formats */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading eyebrow={c.formats.eyebrow} title={c.formats.title} />
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {c.formats.items.map((item) => (
            <div key={item.badge} className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-card">
              <span className="inline-block rounded-md bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                {item.badge}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Professional use cases */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow={c.useCases.eyebrow} title={c.useCases.title} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.useCases.items.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading eyebrow={c.faq.eyebrow} title={c.faq.title} />
        <div className="space-y-3">
          {c.faq.items.map((item) => (
            <details
              key={item.question}
              className="group rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-card"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span className="text-slate-400 group-open:rotate-180" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {c.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">{c.finalCta.description}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="w-full rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:w-auto"
            >
              {c.finalCta.primaryCta}
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:w-auto"
            >
              {c.finalCta.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-6 w-6" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-900">{appName}</span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-5 text-sm text-slate-600">
            {footerNav.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {appName}. {c.footer.rights}
          </p>
        </div>
      </footer>
    </div>
  );
}
