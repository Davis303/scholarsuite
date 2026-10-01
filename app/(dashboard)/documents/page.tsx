import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formatBytes, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { DocumentActions } from "./document-actions";

export interface LibraryDocument {
  id: string;
  name: string;
  kind: "original" | "similarity_report" | "writing";
  source: "documents" | "writing_docs";
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
}

const KIND_LABEL: Record<LibraryDocument["kind"], string> = {
  original: "Original",
  similarity_report: "Similarity report",
  writing: "Writing",
};

const KIND_TONE: Record<LibraryDocument["kind"], "neutral" | "brand" | "amber"> = {
  original: "brand",
  similarity_report: "amber",
  writing: "neutral",
};

interface SearchParams {
  search?: string;
  kind?: string;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: documentRows }, { data: writingRows }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, name, kind, mime_type, size_bytes, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("writing_docs")
      .select("id, name, mime_type, size_bytes, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const library: LibraryDocument[] = [
    ...((documentRows ?? []) as Array<{
      id: string;
      name: string;
      kind: string;
      mime_type: string | null;
      size_bytes: number | null;
      storage_path: string;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      kind: (row.kind === "similarity_report" || row.kind === "writing" ? row.kind : "original") as LibraryDocument["kind"],
      source: "documents" as const,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      storage_path: row.storage_path,
      created_at: row.created_at,
    })),
    ...((writingRows ?? []) as Array<{
      id: string;
      name: string;
      mime_type: string | null;
      size_bytes: number | null;
      storage_path: string;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      kind: "writing" as const,
      source: "writing_docs" as const,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      storage_path: row.storage_path,
      created_at: row.created_at,
    })),
  ];

  const search = (searchParams.search ?? "").trim().toLowerCase();
  const kindFilter = searchParams.kind ?? "all";

  const filtered = library
    .filter((doc) => (kindFilter === "all" ? true : doc.kind === kindFilter))
    .filter((doc) => (search ? doc.name.toLowerCase().includes(search) : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const filterHref = (kind: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", searchParams.search ?? "");
    if (kind !== "all") params.set("kind", kind);
    const query = params.toString();
    return query ? `/documents?${query}` : "/documents";
  };

  const kinds = ["all", "original", "similarity_report", "writing"] as const;

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Your shared document library: every manuscript, similarity report, and writing draft in one place."
        actions={
          <Link
            href="/reviews/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            Upload
          </Link>
        }
      />

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <form method="get" action="/documents" className="flex flex-1 gap-2" role="search">
            <label htmlFor="documents-search" className="sr-only">
              Search documents
            </label>
            <input
              id="documents-search"
              name="search"
              type="search"
              defaultValue={searchParams.search ?? ""}
              placeholder="Search by name…"
              className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            />
            {kindFilter !== "all" ? <input type="hidden" name="kind" value={kindFilter} /> : null}
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              Search
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
            {kinds.map((kind) => {
              const active = kindFilter === kind;
              return (
                <Link
                  key={kind}
                  href={filterHref(kind)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${
                    active
                      ? "bg-accent-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {kind === "all" ? "All" : KIND_LABEL[kind]}
                </Link>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState
              title={library.length === 0 ? "No documents yet" : "No documents match your search"}
              description={
                library.length === 0
                  ? "Upload a manuscript or report to get started."
                  : "Try a different search term or filter."
              }
              action={
                library.length === 0 ? (
                  <Link
                    href="/reviews/new"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
                  >
                    Upload a document
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ss-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Size</th>
                  <th scope="col">Added</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={`${doc.source}-${doc.id}`}>
                    <td>
                      <span className="font-medium text-slate-900">{doc.name}</span>
                      {doc.mime_type ? (
                        <p className="text-xs text-slate-500">{doc.mime_type}</p>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={KIND_TONE[doc.kind]}>{KIND_LABEL[doc.kind]}</Badge>
                    </td>
                    <td>{formatBytes(doc.size_bytes)}</td>
                    <td>{formatDate(doc.created_at)}</td>
                    <td>
                      <DocumentActions doc={doc} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
