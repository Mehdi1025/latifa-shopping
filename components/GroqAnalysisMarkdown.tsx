"use client";

import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  className?: string;
};

/**
 * Rendu Markdown pour les réponses Groq (listes, gras, emojis dans les puces).
 */
export function GroqAnalysisMarkdown({ content, className = "" }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-3 text-[15px] leading-relaxed text-slate-800 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-none space-y-3 pl-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-3 pl-5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[15px] leading-relaxed text-slate-800">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-indigo-700">
              {children}
            </h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function formatVariationEUR(value: number): {
  formatted: string;
  toneClass: string;
} {
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);

  const toneClass =
    value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-white/90";

  return { formatted, toneClass };
}
