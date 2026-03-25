import { AuthGate } from "@/components/AuthGate";
import { QuestionBankClient } from "./QuestionBankClient";

export default function QuestionBankPage() {
  return (
    <AuthGate>
      <QuestionBankClient />
    </AuthGate>
  );
}
