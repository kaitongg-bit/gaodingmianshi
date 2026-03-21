import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

type Props = {
  variant?: "marketing" | "app";
};

export async function SiteHeader({ variant = "marketing" }: Props) {
  const t = await getTranslations("Nav");

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-[var(--text)]"
        >
          InterviewScript
        </Link>
        <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {variant === "app" && (
            <>
              <Link href="/projects" className="hover:text-[var(--text)]">
                {t("projects")}
              </Link>
              <span className="text-[var(--border-strong)]">|</span>
            </>
          )}
          <Link href="/app" className="hover:text-[var(--text)]">
            {t("workspace")}
          </Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
