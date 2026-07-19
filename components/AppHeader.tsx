import PushSubscribe from "@/components/PushSubscribe";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
            D
          </div>
          <span className="text-sm font-semibold text-text">Der&apos;s Tracker</span>
        </div>
        <PushSubscribe />
      </div>
    </header>
  );
}
