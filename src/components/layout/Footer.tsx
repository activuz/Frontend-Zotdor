import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Phone, Mail, MapPin, Award, HeartHandshake } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1e3a0f] text-[#eef2dc] pt-12 pb-8 border-t-4 border-[#3d6b2e] mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-[#3d6b2e]/60">
          
          {/* Column 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <img 
                  src="/favicon.webp" 
                  alt="Zotdor logo" 
                  className="w-11 h-11 rounded-full border-2 border-[#a8d45e] object-cover group-hover:scale-105 transition-transform" 
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#a8d45e] border-2 border-[#1e3a0f] rounded-full animate-pulse"></span>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-white block leading-none font-display">
                  Zotdor<span className="text-[#a8d45e]">.uz</span>
                </span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#a8d45e] block mt-1">
                  O'ZBEKISTON CHORVA MARKETPLACE PLATFORMASI
                </span>
              </div>
            </Link>

            <p className="text-xs text-[#dce8c8]/80 leading-relaxed max-w-md">
              O'zbekiston chorva mollari va zotdor hayvonlar savdosining rasmiy va xavfsiz onlayn bozori. Go'sht va sut yo'nalishidagi qoramol, qo'y-echki, ot hamda noyob zotdor parrandalar savdosi.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <span className="bg-[#3d6b2e] text-[#a8d45e] text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#a8d45e]/30">
                <ShieldCheck className="w-4 h-4" />
                Davlati va Veterinariya sertifikatlangan
              </span>
              <span className="bg-[#3d6b2e] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Award className="w-4 h-4 text-[#a8d45e]" />
                Zotdor 2026
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#a8d45e] font-display">
              Bo'limlar
            </h4>
            <ul className="space-y-2 text-xs font-medium text-[#dce8c8]/85">
              <li>
                <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
                  Bosh sahifa
                </Link>
              </li>
              <li>
                <Link to="/search" className="hover:text-white transition-colors flex items-center gap-1">
                  Barcha e'lonlar va Katalog
                </Link>
              </li>
              <li>
                <Link to="/auction" className="hover:text-white transition-colors flex items-center gap-1">
                  Online Auksionlar
                </Link>
              </li>
              <li>
                <Link to="/add" className="hover:text-white transition-colors flex items-center gap-1 text-[#a8d45e]">
                  + E'lon joylashtirish
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-white transition-colors flex items-center gap-1">
                  Shaxsiy kabinet va Balans
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#a8d45e] font-display">
              Yo'nalishlar
            </h4>
            <ul className="space-y-2 text-xs font-medium text-[#dce8c8]/85">
              <li>
                <Link to="/category/gosht" className="hover:text-white transition-colors">
                  🥩 Go'sht yo'nalishi (Qoramol, Qo'y)
                </Link>
              </li>
              <li>
                <Link to="/category/sut-tuxum" className="hover:text-white transition-colors">
                  🥛 Sut va tuxum yo'nalishi
                </Link>
              </li>
              <li>
                <Link to="/category/korkam" className="hover:text-white transition-colors">
                  🦚 Ko'rkam va dekorativ hayvonlar
                </Link>
              </li>
              <li>
                <Link to="/category/sport-transport" className="hover:text-white transition-colors">
                  🐎 Sport va uloq otlari
                </Link>
              </li>
              <li>
                <Link to="/category/pet" className="hover:text-white transition-colors">
                  🐱 Uy hayvonlari (Pet)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Support */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#a8d45e] font-display">
              Bog'lanish
            </h4>
            <ul className="space-y-2 text-xs text-[#dce8c8]/85">
              <li className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-[#a8d45e] shrink-0" />
                <span>+998 (71) 200-00-00</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#a8d45e] shrink-0" />
                <span>info@zotdor.uz</span>
              </li>
              <li className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#a8d45e] shrink-0" />
                <span>Toshkent sh., Yunusobod tumani</span>
              </li>
              <li className="pt-1">
                <span className="text-[10px] text-[#a8d45e] uppercase font-bold block mb-1">Qo'llab-quvvatlash xizmati</span>
                <span className="text-[11px] font-semibold text-white bg-[#3d6b2e] px-2.5 py-1 rounded inline-flex items-center gap-1">
                  <HeartHandshake className="w-3.5 h-3.5 text-[#a8d45e]" /> 24/7 Telegram Operator
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright and legal line */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#dce8c8]/60 space-y-3 sm:space-y-0">
          <div>
            © 2026 <span className="text-white font-bold font-display">Zotdor.uz</span> Marketplace. Barcha huquqlar himoyalangan.
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span className="hover:text-white cursor-pointer transition-colors">Foydalanish shartlari</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer transition-colors">Maxfiylik siyosati</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer transition-colors">Veterinariya xavfsizligi</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
