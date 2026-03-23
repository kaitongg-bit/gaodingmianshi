import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { WorkspaceClient } from "./WorkspaceClient";

export default function WorkspacePage() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
            …
          </div>
        }
      >
        <WorkspaceClient />
      </Suspense>
    </AuthGate>
  );
}
