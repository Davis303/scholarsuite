import { Card, ToastProvider } from '@/components/reviews/ui';
import { NewReviewWizard } from '@/components/reviews/NewReviewWizard';

export const metadata = {
  title: 'New Review',
};

/**
 * New Review wizard host. Accepts ?documentId= to preselect a document
 * from the shared library (bridge from /documents or the Writing Assistant).
 */
export default function NewReviewPage({
  searchParams,
}: {
  searchParams: { documentId?: string };
}) {
  const documentId =
    typeof searchParams.documentId === 'string' && searchParams.documentId.length > 0
      ? searchParams.documentId
      : null;

  return (
    <ToastProvider>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New similarity review</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload your document and its similarity report. Matched passages are
          identified for your review — content is never rewritten.
        </p>
      </div>
      {documentId ? (
        <NewReviewWizard initialDocumentId={documentId} />
      ) : (
        <NewReviewWizard initialDocumentId={null} />
      )}
      <noscript>
        <Card className="mt-6 p-6">
          <p className="text-sm text-slate-600">
            JavaScript is required for the review wizard.
          </p>
        </Card>
      </noscript>
    </ToastProvider>
  );
}
