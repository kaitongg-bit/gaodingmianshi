import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";

const PLACEHOLDER = [
  { id: "1", title: "XYZ 云 · 高级产品经理", updated: "2026-03-20" },
  { id: "2", title: "模拟体验项目", updated: "2026-03-19" },
];

export default async function ProjectsPage() {
  const t = await getTranslations("Projects");

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="app" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)]">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)]"
          >
            {t("newProject")}
          </button>
        </div>
        <ul className="space-y-2">
          {PLACEHOLDER.map((p) => (
            <li key={p.id}>
              <Link
                href="/app"
                className="surface-card flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--surface-muted)]"
              >
                <span className="text-[var(--text)]">{p.title}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {p.updated} · {t("open")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
