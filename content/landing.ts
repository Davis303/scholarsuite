/**
 * Landing page marketing copy.
 *
 * All headline/body text for the public landing page lives here as plain data.
 * Components in app/page.tsx render it; edit text here without touching layout.
 */

export const landing = {
  header: {
    getStarted: "Start free",
  },
  hero: {
    eyebrow: "Academic integrity workspace",
    title: "Review Academic Similarity Reports With Precision",
    subtitle:
      "Upload your manuscript and its similarity report, identify every matched passage against its source, and produce a highlighted review copy, without ever altering your original document.",
    primaryCta: "Start New Review",
    secondaryCta: "View Demo",
    note:
      "Also includes the Writing Assistant: refine your own drafts with style-aware editing and deep proofreading.",
    previewCaption: "Review workspace (illustrative preview)",
    previewNote:
      "Matched passages are highlighted in your document preview; selecting a match emphasizes it and shows its source details.",
    previewPanelTitle: "Match details",
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "From upload to review copy in four steps",
    description: "A guided workflow that keeps your original document untouched at every stage.",
    steps: [
      {
        step: "Step 1",
        title: "Upload your document",
        description:
          "Add your manuscript as DOCX or PDF. Your original is stored securely and never modified.",
      },
      {
        step: "Step 2",
        title: "Upload the similarity report",
        description:
          "Attach the similarity report PDF. Common report formats are recognized automatically.",
      },
      {
        step: "Step 3",
        title: "Review each match",
        description:
          "Matched passages are mapped into your document with page numbers, source details, and similarity data from the report.",
      },
      {
        step: "Step 4",
        title: "Export a review copy",
        description:
          "Download a highlighted DOCX or PDF review copy: a separate file, clearly labeled, with your original preserved.",
      },
    ],
  },
  features: {
    eyebrow: "Key features",
    title: "Built for careful, professional review",
    items: [
      {
        title: "Precise match mapping",
        description:
          "Matched passages from the report are located in your document with page numbers and surrounding context, using tolerant matching that handles formatting differences.",
      },
      {
        title: "Neutral review language",
        description:
          "Matches are described as matched or source text. They are never auto-labeled. You decide each verdict: properly cited, direct quote, common knowledge, and more.",
      },
      {
        title: "Highlighted review copy",
        description:
          "Export a separate highlighted document that preserves fonts, headings, tables, and structure as much as technically possible.",
      },
      {
        title: "Citation awareness",
        description:
          "The workspace flags when a citation appears near a matched passage, helping you verify attribution quickly.",
      },
      {
        title: "Shared document library",
        description:
          "Every document you upload lives in one library, shared between the Similarity Review Workspace and the Writing Assistant, with no re-uploading.",
      },
      {
        title: "Audit history",
        description:
          "Uploads, reviews, exports, and deletions are recorded in your personal audit log for full traceability.",
      },
    ],
  },
  workflow: {
    eyebrow: "Document review workflow",
    title: "A workspace designed around the way you review",
    description:
      "Navigate matches, inspect sources, and record decisions, all in one split-screen workspace.",
    reviewWorkspace: {
      title: "Similarity Review Workspace",
      bullets: [
        "Page navigation with match counts and match-to-match jumping",
        "Match details panel: passage, source, similarity data, citation status",
        "Review verdicts per passage, with your own notes",
        "Copy matched text to the clipboard for your records",
        "Download history and per-review file relationships",
      ],
    },
    writingAssistant: {
      title: "Writing Assistant",
      intro:
        "A companion module for improving your own drafts: style-aware editing at the passage, paragraph, section, or document level, plus deep proofreading with categorized issues. It works only on your own writing. It never accepts similarity reports and never optimizes for detection scores.",
      bullets: [
        "Upload DOCX or PDF, or start from any document in your library",
        "Choose a style profile; citations and references are protected",
        "Review every suggestion before accepting. Nothing changes silently",
        "Export polished DOCX or PDF copies",
      ],
    },
  },
  security: {
    eyebrow: "Security and privacy",
    title: "Your documents stay yours",
    items: [
      {
        title: "Private by default",
        description:
          "Documents are visible only to you, stored in private storage with short-lived signed download links.",
      },
      {
        title: "Your data, your control",
        description:
          "Delete any document or your entire account at any time. Set automatic retention rules in your privacy settings.",
      },
      {
        title: "Validated uploads",
        description:
          "Files are checked server-side by content and size. Extensions are never trusted.",
      },
      {
        title: "No training on your work",
        description: "Your documents are never used to train models without your consent.",
      },
    ],
    privacyLink: "Read our privacy commitments",
  },
  formats: {
    eyebrow: "Supported file formats",
    title: "Work with the files you already have",
    items: [
      {
        badge: "DOCX",
        description:
          "Microsoft Word documents. Upload originals and writing drafts; export highlighted review copies.",
      },
      {
        badge: "PDF",
        description:
          "Similarity reports and manuscripts. Where in-place highlighting isn't reliable, you'll get a clearly-labeled review copy instead.",
      },
      {
        badge: "Exports",
        description:
          "Download review copies as DOCX or PDF, with a history of every export you've made.",
      },
    ],
  },
  useCases: {
    eyebrow: "Professional use cases",
    title: "Who uses this workspace",
    items: [
      {
        title: "Researchers",
        description:
          "Check manuscripts before submission and address matched passages with full context.",
      },
      {
        title: "Editors",
        description:
          "Review author submissions systematically, with a verdict recorded for every match.",
      },
      {
        title: "University staff",
        description:
          "Support academic integrity workflows with a clear, auditable review process.",
      },
      {
        title: "Consultants",
        description:
          "Prepare client documents with a professional, documented review trail.",
      },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Frequently asked questions",
    items: [
      {
        question: "Does the tool rewrite or paraphrase my text?",
        answer:
          "No. The Similarity Review Workspace never rewrites, paraphrases, or alters your content. It identifies matched passages and produces a highlighted review copy for your own review.",
      },
      {
        question: "Will my original document be changed?",
        answer:
          "Never. Your original is stored separately and is never modified. Exports are always separate review copies.",
      },
      {
        question: "Do I need an AI subscription to review similarity reports?",
        answer: "No. The full review and highlighting workflow works without any AI configuration.",
      },
      {
        question: "Can I use the Writing Assistant and the review workspace together?",
        answer:
          "Yes. They share one workspace and one document library. Move a document between modules without re-uploading.",
      },
      {
        question: "Is my work private?",
        answer:
          "Yes. Your documents are visible only to you, never publicly accessible, and you can delete them at any time.",
      },
      {
        question: "Do I need to create an account?",
        answer:
          "No. ScholarSuite is completely free with no account needed. Just open the app and start working.",
      },
    ],
  },
  finalCta: {
    title: "Start reviewing with confidence",
    description:
      "Open the app, upload your first document, and see every match in context, with your originals always safe.",
    primaryCta: "Start New Review",
    secondaryCta: "Read the manual",
  },
  footer: {
    rights: "All rights reserved.",
  },
};
