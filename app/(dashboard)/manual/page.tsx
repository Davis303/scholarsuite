import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAppName } from "@/content/site";

const appName = getAppName();

interface TocItem {
  id: string;
  label: string;
}

const TOC: TocItem[] = [
  { id: "what-is", label: "What is ScholarSuite?" },
  { id: "writing-assistant", label: "Writing Assistant" },
  { id: "deep-proofread", label: "Deep Proofread" },
  { id: "similarity-review", label: "Similarity Review" },
  { id: "accounts", label: "Accounts: sign up, sign in & guest mode" },
  { id: "privacy", label: "Privacy & your data" },
  { id: "faq", label: "Frequently asked questions" },
];

const FAQS: Array<[string, string]> = [
  [
    "Does ScholarSuite rewrite my text to beat similarity checkers?",
    `No — never. The Writing Assistant helps improve your own drafts for clarity, grammar, and academic style, and the Similarity Review only highlights and organizes matches so you can check them. Matched passages are never rewritten or paraphrased, and nothing is ever optimized for a similarity score.`,
  ],
  [
    "Will my original document ever be changed?",
    `No. Your uploaded files are never modified. The Similarity Review creates a separate highlighted review copy, and the Writing Assistant only applies changes you explicitly accept — your original stays exactly as you uploaded it.`,
  ],
  [
    "Is ScholarSuite free? Are there usage limits?",
    `Yes, it's free, and there are no usage limits — no word caps, no locked features, no throttling. Everything in the app is fully usable.`,
  ],
  [
    "Can I try it without creating an account?",
    `Yes. Choose "Continue as guest" on the sign-in page. Guest work is temporary and may be removed automatically, so create a free account when you want to keep your documents permanently.`,
  ],
  [
    "What files can I upload?",
    `Manuscripts and drafts as DOCX or PDF for both tools. Similarity reports are accepted as PDF. Highlighted review copies can be downloaded as DOCX, and as PDF where the format allows it.`,
  ],
  [
    "Do the AI writing suggestions always work?",
    `The review, highlighting, and proofreading-organization tools always work. AI-generated writing suggestions need the site owner to connect an AI service — if it isn't connected, you'll see a clear notice instead of a suggestion, and everything else keeps working normally.`,
  ],
];

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
          Section {index}
        </p>
        <h2
          id={`${id}-heading`}
          className="mt-1 text-lg font-semibold tracking-tight text-slate-900"
        >
          {title}
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
          {children}
        </div>
      </Card>
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-800"
          >
            {i + 1}
          </span>
          <div className="pt-0.5">{item}</div>
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm leading-relaxed text-amber-900">{children}</p>
    </div>
  );
}

export default function ManualPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="User Manual"
        description={`How to use ${appName}: what each tool does, how the workflows run, and how your account and data work.`}
      />

      <Card className="mb-6 p-6">
        <h2 className="text-base font-semibold text-slate-900">Contents</h2>
        <ol className="mt-3 space-y-2">
          {TOC.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-800"
                >
                  {i + 1}
                </span>
                <span className="font-medium group-hover:underline">{item.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </Card>

      <div className="space-y-6">
        <Section id="what-is" index={1} title={`What is ${appName}?`}>
          <p>
            {appName} is one product at one address, with <strong className="font-semibold text-slate-900">two tools</strong> that
            share a single document library and a single account:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-semibold text-slate-900">Writing Assistant</strong> — improves
              your own academic drafts: clearer sentences, better grammar, and a consistent academic
              style that still sounds like you.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Similarity Review</strong> — reviews a
              similarity report against your manuscript: it finds the matched passages, highlights
              them in a review copy, and helps you check each one calmly and systematically.
            </li>
          </ul>
          <p>
            <strong className="font-semibold text-slate-900">The bridge between them:</strong> every
            document you upload lives in one shared library, visible from both tools. From any
            writing draft you can choose <em>Send to similarity review</em> to carry the document
            straight over — no re-uploading, no second login. Both tools are always one click away
            in the left sidebar.
          </p>
        </Section>

        <Section id="writing-assistant" index={2} title="Writing Assistant — what it's for & how to use it">
          <p>
            <strong className="font-semibold text-slate-900">What it&apos;s for:</strong> improving
            drafts you wrote yourself — clearer sentences, correct grammar, and polished academic
            expression. It learns <em>your</em> writing style first, so suggestions sound like you
            on a good day, not like a robot.
          </p>
          <p className="font-medium text-slate-900">How to use it:</p>
          <Steps
            items={[
              <>
                <strong className="font-semibold text-slate-900">Upload your document</strong> (DOCX
                or PDF), or pick an existing draft from your{" "}
                <Link href="/documents" className="font-medium text-accent-700 underline hover:text-accent-800">document library</Link>.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Let it learn your style.</strong>{" "}
                The app reads the whole document and builds your personal style profile — your tone,
                sentence length, and vocabulary — before suggesting anything.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Choose how much to improve:</strong>{" "}
                selected text, a paragraph, a whole section, or the entire document.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Review each suggestion side by side</strong> —
                your original next to the improved version.
              </>,
              <>
                For every suggestion choose <strong className="font-semibold text-slate-900">Accept</strong>,{" "}
                <strong className="font-semibold text-slate-900">Regenerate</strong> (try another
                version), <strong className="font-semibold text-slate-900">Edit</strong> it yourself,
                or <strong className="font-semibold text-slate-900">Keep Original</strong>.
              </>,
              <>
                Open <strong className="font-semibold text-slate-900">View Changes</strong> to see
                every edit side by side, then download your finished{" "}
                <strong className="font-semibold text-slate-900">DOCX</strong> or{" "}
                <strong className="font-semibold text-slate-900">PDF</strong>.
              </>,
            ]}
          />
          <Note>
            <strong className="font-semibold">Good to know:</strong> the Writing Assistant never
            rewrites your reference list, never invents citations or facts, keeps every citation
            attached to the claim it supports, and never uses em dashes.
          </Note>
        </Section>

        <Section id="deep-proofread" index={3} title="Deep Proofread — what it's for & how to use it">
          <p>
            <strong className="font-semibold text-slate-900">What it&apos;s for:</strong> a final
            quality check before you submit — grammar, academic style, clarity, citations,
            references, and numbers, all reviewed in the context of your full document.
          </p>
          <p className="font-medium text-slate-900">How to use it:</p>
          <Steps
            items={[
              <>
                Open a document in the Writing Assistant and switch to the{" "}
                <strong className="font-semibold text-slate-900">Deep Proofread</strong> tab.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Choose the scope:</strong> selected
                text, the current paragraph, the current section, or the entire document.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Work through the issues list.</strong>{" "}
                Each issue shows its severity — <strong className="font-semibold text-slate-900">Minor</strong>,{" "}
                <strong className="font-semibold text-slate-900">Needs Review</strong>, or{" "}
                <strong className="font-semibold text-slate-900">Important</strong> — along with an
                explanation, a suggested fix, and a confidence level.
              </>,
              <>
                For every suggestion choose <strong className="font-semibold text-slate-900">Accept</strong>,{" "}
                <strong className="font-semibold text-slate-900">Reject</strong>,{" "}
                <strong className="font-semibold text-slate-900">Edit</strong>,{" "}
                <strong className="font-semibold text-slate-900">Ignore</strong>, or{" "}
                <strong className="font-semibold text-slate-900">Add to terminology rules</strong>{" "}
                (so your field&apos;s specialist terms are never flagged again).
              </>,
              <>
                Finish with the <strong className="font-semibold text-slate-900">final summary</strong>:
                what you accepted, what you rejected, and what still needs a look — including
                citation and consistency items to verify yourself.
              </>,
            ]}
          />
          <Note>
            <strong className="font-semibold">You stay in control:</strong> Deep Proofread only
            flags possible issues — nothing in your document changes without your approval.
          </Note>
        </Section>

        <Section id="similarity-review" index={4} title="Similarity Review — what it's for & how to use it">
          <p>
            <strong className="font-semibold text-slate-900">What it&apos;s for:</strong> calmly
            reviewing a similarity report against your manuscript. It shows you exactly where your
            document matches other sources, so you can verify citations and attribution passage by
            passage — using neutral language like &ldquo;matched text,&rdquo; never accusations.
          </p>
          <p className="font-medium text-slate-900">How to use it:</p>
          <Steps
            items={[
              <>
                <strong className="font-semibold text-slate-900">Upload two files:</strong> your
                manuscript (DOCX or PDF) and the similarity report (PDF). You&apos;ll watch real
                processing stages: reading your document, reading the report, detecting matched
                passages, mapping them into your document, and preparing the review copy.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Review each match.</strong> Move
                with <strong className="font-semibold text-slate-900">Previous Match</strong> /{" "}
                <strong className="font-semibold text-slate-900">Next Match</strong> (e.g.
                &ldquo;Match 7 of 24&rdquo;). The document scrolls to each highlighted passage, and
                the Match Details panel shows the page number, the passage, the source, the
                similarity information from the report, and whether a citation was detected.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Record a verdict per match</strong>{" "}
                — Properly Cited, Direct Quote, Common Knowledge, Citation Check, Source
                Verification, or Needs Review — and add a note if you like.
              </>,
              <>
                <strong className="font-semibold text-slate-900">Export the highlighted review copy</strong>{" "}
                as DOCX (or PDF where the format allows). It&apos;s a separate file that preserves
                your fonts, headings, tables, and structure as much as technically possible.
              </>,
            ]}
          />
          <Note>
            <strong className="font-semibold">Important:</strong> Similarity Review does{" "}
            <strong className="font-semibold">not</strong> rewrite or paraphrase matched text, and
            it never modifies your original document — the original always stays untouched.
          </Note>
        </Section>

        <Section id="accounts" index={5} title="Accounts: sign up, sign in & guest mode">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-semibold text-slate-900">Sign up</strong> with your email and
              a password, then click the verification link we email you.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Sign in</strong> with your email and
              password. Tick <strong className="font-semibold text-slate-900">Keep me signed in</strong> to
              stay logged in on that device; leave it unticked and you&apos;ll be signed out when
              you close the browser.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Forgot your password?</strong> Use
              the reset link on the sign-in page to set a new one.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Continue as guest</strong> to try the
              tools without an account. Guest work is temporary and may be removed automatically —
              create a free account at any time to keep it, and your current work carries over.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">One account, both tools.</strong> The
              same sign-in unlocks the Writing Assistant and Similarity Review — and in Settings →
              Active sessions you can see your signed-in devices and sign out everywhere at once.
            </li>
          </ul>
        </Section>

        <Section id="privacy" index={6} title="Privacy & your data">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-semibold text-slate-900">Private by default.</strong> Your
              documents are visible only to you — never public, never indexed, never shared.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Delete anytime.</strong> Remove any
              document from your library whenever you like, or delete your whole account and
              everything goes with it.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Automatic cleanup, on your terms.</strong>{" "}
              In Settings → Privacy & data you can set how long documents are kept and switch on
              automatic deletion.
            </li>
            <li>
              <strong className="font-semibold text-slate-900">Never used for training</strong> without
              your explicit consent.
            </li>
          </ul>
          <p>
            Read the full commitments on the{" "}
            <Link
              href="/privacy"
              className="font-medium text-accent-700 underline hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              Privacy page
            </Link>
            .
          </p>
        </Section>

        <Section id="faq" index={7} title="Frequently asked questions">
          <div className="space-y-3">
            {FAQS.map(([question, answer]) => (
              <details
                key={question}
                className="group rounded-lg border border-slate-200 bg-white px-4 py-3 open:shadow-sm"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {question}
                    <svg
                      className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
