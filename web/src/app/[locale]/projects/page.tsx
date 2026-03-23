import { AuthGate } from "@/components/AuthGate";
import { ProjectsClient } from "./ProjectsClient";

export default function ProjectsPage() {
  return (
    <AuthGate>
      <ProjectsClient />
    </AuthGate>
  );
}
