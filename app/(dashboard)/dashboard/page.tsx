import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

const REVIEW_STATUS_TONE: Record<string, "neutral" | "brand" | "amber" | "red" | "green"> = {
  processing: "neutral",
  ready: "green",
  review_required: "amber",
  completed: "brand",
  failed: "red",
};

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface ReviewRow {
  id: string;
  title: string | null;
  status: string;
  total_matches: number | null;
  created_at: string;
  updated_at: string;
  documents: { name: string } | null;
}

interface WritingDocRow {
  id: string;
  name: string;
  updated_at: string;
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </Link>
  );
}

export default async function DashboardHomePage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ count: reviewCount }, { count: documentCount }, { count: passageCount }, { count: writingCount }] =
    await Promise.all([
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("matched_passages").select("id", { count: "exact", head: true }),
      supabase.from("writing_docs").select("id", { count: "exact", head: true }),
    ]);

  const { data: recentReviews } = await supabase
    .from("reviews")
    .select("id, title, status, total_matches, created_at, updated_at, documents ( name )")
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: recentWriting } = await supabase
    .from("writing_docs")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const reviews = (recentReviews ?? []) as unknown as ReviewRow[];
  const writingDocs = (recentWriting ?? []) as unknown as WritingDocRow[];

  return (
    <div>
      <PageHeader
        title={user.is_anonymous ? "Welcome" : "Dashboard"}
        description="An overview of your reviews, documents, and writing work."
        actions={
          <>
            <Link
              href="/writing/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
            >
              New Writing Document
            </Link>
            <Link
              href="/reviews/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
            >
              Start New Review
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Reviews" value={reviewCount ?? 0} href="/reviews" />
        <StatCard label="Documents" value={documentCount ?? 0} href="/documents" />
        <StatCard label="Matched Passages" value={passageCount ?? 0} href="/reviews" />
        <StatCard label="Writing Documents" value={writingCount ?? 0} href="/writing" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Recent reviews</h2>
            <Link
              href="/reviews"
              className="text-sm font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              View all
            </Link>
          </div>
          {reviews.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                title="No reviews yet"
                description="Start your first similarity review to see it here."
                action={
                  <Link
                    href="/reviews/new"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
                  >
                    Start New Review
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Status</th>
                    <th scope="col">Matches</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        <Link
                          href={`/reviews/${review.id}`}
                          className="font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                        >
                          {review.title || review.documents?.name || "Untitled review"}
                        </Link>
                        <p className="text-xs text-slate-500">{formatDate(review.created_at)}</p>
                      </td>
                      <td>
                        <Badge tone={REVIEW_STATUS_TONE[review.status] ?? "neutral"}>
                          {statusLabel(review.status)}
                        </Badge>
                      </td>
                      <td>{review.total_matches ?? 0}</td>
                      <td>{formatRelativeTime(review.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Recent writing documents</h2>
            <Link
              href="/writing"
              className="text-sm font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              View all
            </Link>
          </div>
          {writingDocs.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                title="No writing documents yet"
                description="Create a document to start refining your own draft."
                action={
                  <Link
                    href="/writing/new"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
                  >
                    New Writing Document
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {writingDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <Link
                          href={`/writing/${doc.id}`}
                          className="font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                        >
                          {doc.name}
                        </Link>
                      </td>
                      <td>{formatRelativeTime(doc.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
