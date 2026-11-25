import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { LEGAL_DOCS, LEGAL_ORDER, type LegalSlug } from './content';

/** /terms, /privacy, /offer (PRD FR-17). Static text: no loading or error states needed. */
export const LegalPage: React.FC<{ slug: LegalSlug }> = ({ slug }) => {
  const doc = LEGAL_DOCS[slug];
  useSeo({ title: doc.title, description: doc.description, path: `/${slug}` });

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Huquqiy hujjatlar" className="mb-6 lg:mb-0">
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:sticky lg:top-24">
          {LEGAL_ORDER.map((s) => (
            <li key={s}>
              <Link
                to={`/${s}`}
                aria-current={s === slug ? 'page' : undefined}
                className={`inline-flex min-h-touch items-center rounded-xl px-3 text-[15px] font-medium ${
                  s === slug ? 'bg-brand-soft text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {LEGAL_DOCS[s].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className="max-w-3xl">
        <h1 className="font-display text-[32px] leading-tight text-ink">{doc.title}</h1>
        <p className="mt-2 text-[13px] text-ink-muted">Tahrir sanasi: {formatDate(doc.updated)}</p>
        <div className="mt-6 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[20px] font-semibold text-ink">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">
                {section.body.map((block, i) =>
                  typeof block === 'string' ? (
                    <p key={i}>{block}</p>
                  ) : (
                    <ul key={i} className="list-disc space-y-2 pl-5">
                      {block.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
};
