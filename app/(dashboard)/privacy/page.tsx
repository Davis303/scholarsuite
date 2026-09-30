import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "ScholarSuite";

const COMMITMENTS: Array<[string, string]> = [
  [
    "Your documents are private",
    `Every document you upload to ${appName} is visible only to you. Files live in private storage and are served through short-lived signed links — there are no public URLs and nothing is indexed by search engines.`,
  ],
  [
    "Your work belongs to you",
    "You own your manuscripts, reports, and writing drafts. We claim no rights over them, and we never share or sell your content.",
  ],
  [
    "Delete anything, anytime",
    "Remove individual documents from your library whenever you like. Deleting a document removes its stored files and its records. You can also delete your entire account — everything goes with it.",
  ],
  [
    "Automatic cleanup, on your terms",
    "In your privacy settings you can set how long documents are kept and turn on automatic deletion. A scheduled cleanup permanently removes documents older than your retention period — files and database records alike.",
  ],
  [
    "Temporary files are removed",
    "Working files created during processing are cleaned up automatically; only your originals, your review copies, and your exports are kept.",
  ],
  [
    "Never used for training without consent",
    "Your documents are never used to train machine learning models without your explicit consent.",
  ],
  [
    "Validated, isolated storage",
    "Uploads are validated server-side by file content and size — file extensions are never trusted. Strict per-user isolation means your data is separated from every other account at the database level.",
  ],
  [
    "Transparent activity log",
    "Uploads, reviews, exports, deletions, and sign-ins are recorded in your personal audit log, so you can always see what happened to your work.",
  ],
];

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Privacy"
        description={`How ${appName} protects your documents and your data.`}
      />
      <div className="space-y-4">
        {COMMITMENTS.map(([title, description]) => (
          <Card key={title} className="p-6">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-slate-900">Questions about your data?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Manage retention and deletion anytime in{" "}
          <a
            href="/settings/privacy"
            className="font-medium text-brand-700 underline hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Settings → Privacy & data
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
