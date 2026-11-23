import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Contacts, certificates and legal pages are shown only when the product owner provides real
 * ones (AGENTS.md, DESIGN.md §5), so the footer stays minimal for now.
 */
export const Footer: React.FC = () => (
  <footer className="hidden md:block border-t border-line mt-12">
    <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[15px] text-ink-muted">
      <p>© {new Date().getFullYear()} Zotdor.uz — chorva auksioni</p>
      <nav aria-label="Pastki havolalar">
        <ul className="flex gap-4">
          <li>
            <Link to="/search" className="hover:text-ink">
              Auksionlar
            </Link>
          </li>
          <li>
            <Link to="/sell" className="hover:text-ink">
              Sotish
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  </footer>
);
