import React from 'react';
import { Link } from 'react-router-dom';

/** Certificates and other claims are shown only when the product owner provides real ones (DESIGN.md §5). */
export const Footer: React.FC = () => (
  <footer className="hidden md:block border-t border-line mt-12">
    <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[15px] text-ink-muted">
      <p>© {new Date().getFullYear()} Zotdor.uz — chorva auksioni</p>
      <nav aria-label="Pastki havolalar">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
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
          <li>
            <Link to="/terms" className="hover:text-ink">
              Foydalanish shartlari
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="hover:text-ink">
              Maxfiylik siyosati
            </Link>
          </li>
          <li>
            <Link to="/offer" className="hover:text-ink">
              Oferta
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  </footer>
);
