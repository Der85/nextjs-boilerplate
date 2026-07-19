export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl font-bold text-white shadow-lg">
          D
        </div>
        <h1 className="text-xl font-semibold text-text">Der&apos;s Tracker</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
