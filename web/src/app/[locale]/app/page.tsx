import { SiteHeader } from "@/components/SiteHeader";
import { Workbench } from "@/components/Workbench";

export default function AppPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader variant="app" />
      <Workbench />
    </div>
  );
}
