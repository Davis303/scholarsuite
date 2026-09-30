import Link from "next/link";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "ScholarSuite";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="mx-auto w-full max-w-md px-4 pt-10">
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <img src="/logo.svg" alt="" className="h-9 w-9" aria-hidden="true" />
          <span className="text-xl font-semibold tracking-tight text-slate-900">{appName}</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">{children}</main>
      <footer className="pb-8 text-center text-xs text-slate-500">
        <Link href="/privacy" className="underline hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
