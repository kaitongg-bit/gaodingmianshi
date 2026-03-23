import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { PrepClient } from "./PrepClient";

export default function PrepPage() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
            …
          </div>
        }
      >
        <PrepClient />
      </Suspense>
    </AuthGate>
  );
}
