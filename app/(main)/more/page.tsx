"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, PageHeading } from "@/components/ui";

export default function MorePage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeading title="More" subtitle="Settings & account" />

      <div className="flex flex-col gap-3">
        <Link href="/settings/providers">
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text">Providers</p>
              <p className="text-xs text-muted">
                Prescribers, pharmacies & contacts
              </p>
            </div>
            <Chevron />
          </Card>
        </Link>

        <Link href="/settings/inventory">
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text">Inventory / reorders</p>
              <p className="text-xs text-muted">Log a new prescription order</p>
            </div>
            <Chevron />
          </Card>
        </Link>

        <button type="button" onClick={signOut} disabled={signingOut}>
          <Card className="flex items-center justify-between">
            <span className="font-medium text-bad">
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
          </Card>
        </button>
      </div>
    </>
  );
}

function Chevron() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
