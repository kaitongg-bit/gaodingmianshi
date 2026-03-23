import { AuthGate } from "@/components/AuthGate";
import { DraftNav } from "@/components/DraftNav";
import { SupportForm } from "./SupportForm";

export default function SupportPage() {
  return (
    <>
      <DraftNav variant="marketing" />
      <AuthGate>
        <main id="main" className="mx-auto max-w-lg px-4 pb-24 pt-24">
          <SupportForm />
        </main>
      </AuthGate>
    </>
  );
}
