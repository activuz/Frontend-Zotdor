import { Category } from '../types';

export const MOCK_CATEGORIES: Category[] = [
  {
    id: 'gosht',
    name: "Go'sht yo'nalishi",
    shortName: "Go'sht",
    icon: '🥩',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    description: "Tez vazn oladigan, bo'rdoqchilik va go'sht yetishtirishga mo'ljallangan zotdor chorvalar",
    itemCount: 428,
  },
  {
    id: 'sut-tuxum',
    name: "Sut-tuxum yo'nalishi",
    shortName: "Sut-tuxum",
    icon: '🥛',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: "Yuqori mahsuldor sotiladigan sigirlar, echkilar va parranda turlari",
    itemCount: 312,
  },
  {
    id: 'korkam',
    name: "Ko'rkam / Manzarali",
    shortName: "Ko'rkam",
    icon: '🦚',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: "Ko'rgazmali, manzarali qushlar, nodir zotli tovus, kabutar va quyonlar",
    itemCount: 154,
  },
  {
    id: 'sport-transport',
    name: "Sport va transport",
    shortName: "Sport",
    icon: '🐎',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: "Chopqir otlar, uloq-ko'pkari otlari, tulporlar hamda yuk tashuvchi ulovlar",
    itemCount: 96,
  },
  {
    id: 'pet',
    name: "Uy hayvonlari (Pet)",
    shortName: "Uy hayvoni",
    icon: '🐕',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: "Zotdor itlar, mushuklar va uyda boqiladigan sevimli jonivorlar",
    itemCount: 187,
  },
];
