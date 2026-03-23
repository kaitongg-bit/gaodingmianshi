import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  className?: string;
};

export function MarkdownBody({ content, className = "" }: Props) {
  return (
    <div className={`text-[var(--on-surface)] ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--on-surface)]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <p className="mb-2 font-headline text-base font-semibold">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mb-2 font-headline text-sm font-semibold">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mb-1.5 font-headline text-sm font-semibold">{children}</p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-[var(--primary)]/40 pl-3 text-[var(--on-surface-variant)]">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-lg bg-[var(--surface-container-high)] p-3 text-xs leading-relaxed">
              {children}
            </pre>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-[var(--surface-container-high)] px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
