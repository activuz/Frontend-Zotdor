/**
 * Legal texts (PRD FR-17). Drafted from the business rules in docs/PRD.md at the owner's request
 * (2026-11-25) and must be reviewed by a lawyer. The operator's legal details (name, STIR,
 * address) are not given yet, so no requisites block is shown: never invent them.
 * Numbers that admins can change (commission rate, bonus, limits) are described, not hard-coded.
 */

export type LegalSlug = 'terms' | 'privacy' | 'offer';

export interface LegalSection {
  heading: string;
  /** A string is a paragraph; an array of strings is a bulleted list. */
  body: (string | string[])[];
}

export interface LegalDoc {
  slug: LegalSlug;
  title: string;
  description: string;
  updated: string;
  sections: LegalSection[];
}

const UPDATED = '2026-11-25';

const CONTACT =
  'Savol va murojaatlar uchun: Telegram kanal t.me/zotdor_chorva_bozor yoki telefon +998 93 884 89 10.';

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  terms: {
    slug: 'terms',
    title: 'Foydalanish shartlari',
    description:
      'Zotdor.uz chorva auksioni platformasidan foydalanish qoidalari: akkaunt, auksion, takliflar, bitim va moderatsiya.',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Umumiy qoidalar',
        body: [
          'Zotdor.uz (keyingi oʻrinlarda — Platforma) chorva mollarini auksion orqali sotish va sotib olish uchun onlayn xizmat. Platforma web.zotdor.uz manzilida va Telegram bot orqali ishlaydi.',
          'Platformadan foydalanish orqali siz ushbu shartlarga, Maxfiylik siyosatiga va Ommaviy ofertaga rozilik bildirasiz. Rozi boʻlmasangiz, Platformadan foydalanmang.',
          'Platforma sotuvchi va xaridorni bogʻlaydi. Platforma mol egasi ham, sotuvchi ham emas va mol boʻyicha bitimning tarafi hisoblanmaydi.',
        ],
      },
      {
        heading: '2. Akkaunt',
        body: [
          [
            'Kirish faqat +998 bilan boshlanadigan telefon raqami va Telegram bot orqali amalga oshiriladi. Botda ulashilgan kontakt sizning Telegram akkauntingizga tegishli va saytda kiritilgan raqamga mos boʻlishi shart.',
            'Bitta telefon raqami — bitta akkaunt va bitta Telegram akkaunt.',
            'Akkauntingizdan qilingan harakatlar uchun siz javobgarsiz.',
          ],
        ],
      },
      {
        heading: '3. Auksion eʼlon qilish',
        body: [
          [
            'Bitta auksionda bitta hayvon sotiladi.',
            'Rasm va video faqat ilova ichidagi kamera bilan olinadi. Galereyadan yuklash mumkin emas. Rasm va videolarning eng kam va eng koʻp soni sotish sahifasida koʻrsatiladi.',
            'Hayvon haqidagi maʼlumot (tur, toifa, zot, yosh, vazn, joylashuv) haqiqatga mos boʻlishi kerak.',
            'Tavsifda telefon raqami, Telegram username, havola va haqorat boʻlishi mumkin emas. Bu avtomatik tekshiriladi.',
            'Avtomatik tekshiruvdan oʻtgan auksion darhol eʼlon qilinadi. Natijasi noaniq boʻlsa, auksionni moderator koʻrib chiqadi. Aniq qoidabuzarlikda auksion sababi koʻrsatilgan holda rad etiladi.',
            'Auksionni boshlanishidan oldin istalgan payt, jonli auksionni esa faqat hali taklif boʻlmasa bekor qilish mumkin.',
          ],
        ],
      },
      {
        heading: '4. Takliflar',
        body: [
          [
            'Taklifni faqat tizimga kirgan va bloklanmagan foydalanuvchi jonli auksionga beradi. Sotuvchi oʻz auksioniga taklif bera olmaydi.',
            'Taklifning eng kam va eng koʻp miqdori sotuvchi narxiga nisbatan belgilanadi va auksion sahifasida koʻrsatiladi.',
            'Har bir xaridorda bitta faol taklif boʻladi. Yangi taklif oldingisini almashtiradi.',
            'Auksion davomida xaridorlarning ismi yashiriladi, ular “Xaridor #N” deb koʻrsatiladi.',
          ],
        ],
      },
      {
        heading: '5. Gʻolibni tanlash va bitim',
        body: [
          [
            'Auksion tugagach, sotuvchi 48 soat ichida istalgan faol taklifni qabul qiladi yoki hammasini rad etadi. Muddat oʻtsa, auksion “sotilmadi” holatiga oʻtadi.',
            'Sotuvchi eng yuqori taklifni tanlashga majbur emas.',
            'Taklif qabul qilinganda bitim yaratiladi, komissiya yechiladi va shundan keyingina ikki tomonga bir-birining ismi va telefoni ochiladi.',
            'Molni koʻrish, topshirish va mol uchun toʻlov tomonlar oʻrtasida bevosita, Platformadan tashqarida amalga oshiriladi. Molning holati, sogʻligʻi, hujjatlari va toʻlov uchun tomonlarning oʻzi javobgar.',
            'Bitim amalga oshmasa, sotuvchi 7 kun ichida “Bitim boʻlmadi” arizasini beradi. Moderator ariza asosli deb topsa, komissiya balansga qaytariladi.',
            'Bitimdan keyin 14 kun ichida tomonlar bir-birini 1–5 ball bilan baholashi mumkin.',
          ],
        ],
      },
      {
        heading: '6. Pul va komissiya',
        body: [
          'Platforma xizmati uchun haq va uni toʻlash tartibi Ommaviy ofertada yozilgan. Xaridor Platformaga hech narsa toʻlamaydi.',
        ],
      },
      {
        heading: '7. Taqiqlangan harakatlar',
        body: [
          [
            'boshqa joydan olingan, eski yoki boshqa hayvonga tegishli surat va videolardan foydalanish;',
            'notoʻgʻri maʼlumot berish, firibgarlik, soxta takliflar;',
            'bitimdan oldin kontakt almashishga urinish (tavsif, rasm yoki video orqali);',
            'haqorat va nojoʻya xatti-harakat;',
            'qonun bilan taqiqlangan hayvonni yoki kasalligini bila turib hayvonni sotish;',
            'Platforma ishini buzishga urinish.',
          ],
        ],
      },
      {
        heading: '8. Shikoyat va bloklash',
        body: [
          'Har qanday foydalanuvchi auksion yoki boshqa foydalanuvchi ustidan shikoyat qila oladi. Moderator qoidabuzarlikda auksionni yoki foydalanuvchini bloklashi mumkin. Bloklangan auksionning rezervi qaytariladi va faol takliflari bekor qilinadi. Bloklangan foydalanuvchi taklif bera olmaydi va auksion ocha olmaydi.',
        ],
      },
      {
        heading: '9. Javobgarlik chegarasi',
        body: [
          'Platforma eʼlonlardagi maʼlumotning toʻgʻriligini, molning sifatini va tomonlarning bitimni bajarishini kafolatlamaydi. Platforma xizmatning uzluksiz ishlashiga kafolat bermaydi, lekin nosozliklarni imkon qadar tez bartaraf etadi.',
        ],
      },
      {
        heading: '10. Shartlarning oʻzgarishi',
        body: [
          'Platforma ushbu shartlarni oʻzgartirishi mumkin. Yangi tahrir shu sahifada eʼlon qilingan kundan kuchga kiradi. Oʻzgarishdan keyin Platformadan foydalanishni davom ettirish yangi tahrirga rozilikni bildiradi.',
          CONTACT,
        ],
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Maxfiylik siyosati',
    description:
      'Zotdor.uz qaysi shaxsiy maʼlumotlarni yigʻadi, ulardan qanday foydalanadi, kimga koʻrsatadi va qanday himoya qiladi.',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Qaysi maʼlumotlarni yigʻamiz',
        body: [
          [
            'Telefon raqami va Telegram akkaunt maʼlumotlari (identifikator, username, ism) — kirish uchun.',
            'Profil: ism, familiya, viloyat va tuman.',
            'Joylashuvingiz — faqat siz “Joylashuvimni aniqlash” tugmasini bosib brauzerda ruxsat bersangiz yoki nuqtani xaritadan tanlasangiz. U taxminan 100 metrgacha yaxlitlanib saqlanadi va faqat yaqin auksionlarni saralash hamda masofani hisoblash uchun ishlatiladi. Tizimga kirmagan boʻlsangiz, u faqat brauzeringizda turadi. Joylashuv berilmasa, tumaningiz markazi ishlatiladi. Uni istalgan payt profilda oʻchirishingiz mumkin.',
            'Auksionlar, rasm va videolar, takliflar, bitimlar, baholar va shikoyatlar.',
            'Balans harakatlari va Click orqali toʻlovlar haqidagi maʼlumot. Karta maʼlumotlari bizga kelmaydi, ularni Click qayta ishlaydi.',
            'Texnik maʼlumotlar: IP manzil, brauzer turi, kirish vaqti — xavfsizlik va suiisteʼmolning oldini olish uchun.',
            'Brauzer bildirishnomalarini yoqsangiz: brauzeringiz bergan obuna manzili va shifrlash kalitlari — faqat sizga bildirishnoma yuborish uchun. Ularni bildirishnomalar sahifasida yoki tizimdan chiqib oʻchirishingiz mumkin.',
            'Xatolik haqida xabar yuborsangiz: yozgan matningiz, sahifa manzili, ekran oʻlchami, brauzer turi va xato matni — faqat muammoni tuzatish uchun.',
            'zotdor.uz saytidagi ariza formasi orqali yuborilgan ism, telefon, hudud va xabar.',
          ],
        ],
      },
      {
        heading: '2. Nima uchun foydalanamiz',
        body: [
          [
            'akkauntga kirish va uni himoyalash;',
            'auksion, taklif va bitim jarayonini taʼminlash;',
            'komissiyani hisoblash va balansni yuritish;',
            'bildirishnomalar yuborish (sayt va Telegram orqali);',
            'qoidabuzarliklarni aniqlash va shikoyatlarni koʻrib chiqish;',
            'ariza qoldirganlar bilan bogʻlanish.',
          ],
        ],
      },
      {
        heading: '3. Kimga koʻrinadi',
        body: [
          [
            'Auksion davomida xaridorlarning ismi va telefoni hech kimga koʻrinmaydi: ular “Xaridor #N” deb koʻrsatiladi.',
            'Sotuvchi gʻolibni tanlashda xaridorning summasi, masofasi, reytingi va bitimlar sonini koʻradi, lekin ismi va telefonini koʻrmaydi.',
            'Ism va telefon faqat bitim tuzilgandan keyin va faqat bitimning ikki tarafiga ochiladi.',
            'Ochiq profilda ism, familiyaning birinchi harfi, viloyat, reyting va bitimlar soni koʻrsatiladi.',
            'Auksionda viloyat va tuman koʻrsatiladi, aniq manzil koʻrsatilmaydi. Qurilmangiz joylashuvi hech kimga koʻrsatilmaydi: boshqalar faqat taxminiy masofani koʻradi.',
            'Sotuvchi molning joylashuvini xaritada belgilasa, boshqalarga faqat taxminiy hudud (taxminan 1,5 km radiusli doira) koʻrsatiladi. Aniq nuqta bitim tuzilgandan keyin telefon raqami bilan birga faqat xaridorga ochiladi.',
            'Moderator va administratorlar maʼlumotlarni xizmat vazifasini bajarish uchun koʻradi. Ularning har bir harakati audit jurnaliga yoziladi.',
          ],
        ],
      },
      {
        heading: '4. Rasm va videolar',
        body: [
          'Siz yuklagan asl fayllar yopiq omborda saqlanadi va hech kimga koʻrsatilmaydi. Saytda ularning qayta ishlangan nusxasi koʻrsatiladi: undan EXIF maʼlumotlari, jumladan GPS koordinatalari olib tashlanadi.',
        ],
      },
      {
        heading: '5. Uchinchi tomonlar',
        body: [
          'Maʼlumotlar sotilmaydi va reklama uchun berilmaydi. Xizmat ishlashi uchun quyidagi provayderlardan foydalanamiz:',
          [
            'Telegram — kirishni tasdiqlash va bildirishnomalar;',
            'Click — balansni toʻldirish;',
            'hosting va maʼlumotlar bazasi provayderlari — sayt, API, baza va fayllarni saqlash.',
          ],
          'Qonunda belgilangan hollarda maʼlumotlar vakolatli davlat organlariga berilishi mumkin.',
        ],
      },
      {
        heading: '6. Cookie fayllar',
        body: [
          'Sayt faqat ishlashi uchun zarur cookie fayllardan foydalanadi: sessiya (siz tizimga kirganingizni bildiradi) va CSRF himoyasi. Reklama va kuzatuv cookie fayllari ishlatilmaydi.',
        ],
      },
      {
        heading: '7. Saqlash va himoya',
        body: [
          'Maʼlumotlar akkauntingiz faol boʻlgan davrda saqlanadi. Balans harakatlari va bitimlar yozuvlari hisob-kitob va nizolarni hal qilish uchun oʻzgartirilmaydigan jurnal sifatida saqlanadi. Ulanish HTTPS orqali shifrlanadi, sessiya cookie fayli JavaScript uchun yopiq.',
        ],
      },
      {
        heading: '8. Sizning huquqlaringiz',
        body: [
          'Profil maʼlumotlaringizni sozlamalarda oʻzgartirishingiz mumkin. Maʼlumotlaringiz nusxasini olish, ularni tuzatish yoki akkauntni oʻchirish uchun bizga murojaat qiling. Balans va bitimlar yozuvlari qonun boʻyicha saqlanishi shart boʻlsa, oʻchirilmasligi mumkin.',
          CONTACT,
        ],
      },
    ],
  },

  offer: {
    slug: 'offer',
    title: 'Ommaviy oferta',
    description:
      'Zotdor.uz xizmatidan foydalanish shartnomasi: komissiya, rezerv, bonus, balansni toʻldirish va pulni qaytarish tartibi.',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Ofertaning predmeti',
        body: [
          'Ushbu hujjat Zotdor.uz Platformasi (keyingi oʻrinlarda — Ijrochi) tomonidan foydalanuvchilarga (keyingi oʻrinlarda — Foydalanuvchi) auksion xizmatini koʻrsatish boʻyicha ommaviy taklif hisoblanadi.',
          'Ijrochi Foydalanuvchiga chorva mollarini auksion orqali sotish uchun eʼlon joylash, takliflar qabul qilish, gʻolibni tanlash va bitim tarafi bilan kontakt almashish imkoniyatini beradi.',
        ],
      },
      {
        heading: '2. Ofertani qabul qilish',
        body: [
          'Foydalanuvchi web.zotdor.uz saytida telefon raqami va Telegram orqali tizimga kirgan paytdan boshlab ofertani toʻliq qabul qilgan hisoblanadi. Shartnoma muddatsiz tuziladi.',
        ],
      },
      {
        heading: '3. Xizmat haqi (komissiya)',
        body: [
          [
            'Komissiyani faqat sotuvchi toʻlaydi. Xaridor uchun xizmat bepul.',
            'Komissiya qabul qilingan taklif summasidan foiz sifatida hisoblanadi va butun soʻmgacha yuqoriga yaxlitlanadi. Joriy stavka auksion eʼlon qilinishidan oldin sotish sahifasida koʻrsatiladi.',
            'Stavka auksion eʼlon qilingan paytda shu auksionga yoziladi va keyin oʻzgarmaydi.',
            'Komissiya faqat bitim tuzilganda, yaʼni sotuvchi taklifni qabul qilganda yechiladi.',
          ],
        ],
      },
      {
        heading: '4. Rezerv',
        body: [
          [
            'Auksionni eʼlon qilish uchun sotuvchining balansida soʻralgan narxdan hisoblangan komissiya miqdori boʻlishi kerak. Bu summa rezervga olinadi.',
            'Bitim tuzilsa, haqiqiy komissiya yechiladi va rezervning qolgani qaytadi.',
            'Bitim boʻlmasa, auksion bekor qilinsa yoki bloklansa, rezerv toʻliq qaytadi.',
            'Haqiqiy komissiya rezervdan katta boʻlsa, farq balansdan yechiladi. Balans yetmasa, asosiy balans manfiy boʻladi va qarz yopilmaguncha yangi auksion ochib boʻlmaydi.',
          ],
        ],
      },
      {
        heading: '5. Bonus',
        body: [
          'Yangi akkauntga bonus beriladi va bu haqda bildirishnoma yuboriladi.',
          'Har bir bitimdan keyin sotuvchi toʻlagan komissiyaning belgilangan ulushi (joriy qiymati Narx boʻlimida koʻrsatiladi) uning bonus hamyoniga qaytadi. Bonus yigʻilib boradi.',
          'Bonus faqat komissiyaga sarflanadi va naqd pulga aylantirilmaydi. Har yangi bonus tushganda butun bonus qoldigʻining amal qilish muddati qaytadan boshlanadi; shu muddat ichida yangi bonus tushmasa, qoldiq kuchini yoʻqotadi. Komissiya avval bonusdan, keyin asosiy balansdan yechiladi. Bonus qoldigʻi va amal qilish muddati Hamyon sahifasida koʻrsatiladi.',
          'Bitim boʻyicha komissiya qaytarilsa (“Bitim boʻlmadi” arizasi tasdiqlansa), shu bitimdan tushgan bonus ham bonus qoldigʻidan qaytarib olinadi.',
        ],
      },
      {
        heading: '6. Balansni toʻldirish',
        body: [
          'Asosiy balans Click toʻlov tizimi orqali toʻldiriladi. Toʻlov Click tasdiqlagandan keyin balansga tushadi. Har bir pul harakati oʻzgartirilmaydigan jurnalga yoziladi.',
        ],
      },
      {
        heading: '7. Pulni qaytarish',
        body: [
          [
            'Balansdan pulni avtomatik yechib olish imkoniyati yoʻq. Foydalanuvchi Hamyon sahifasida pulni qaytarish arizasini beradi: summa, Click toʻlov raqami va sabab.',
            'Moderator arizani koʻrib chiqadi va pulni Click orqali qaytaradi. Shundan keyin summa balansdan ayiriladi.',
            'Bonus naqd qilinmaydi va qaytarilmaydi.',
            'Bitim amalga oshmasa, sotuvchi bitimdan keyin 7 kun ichida “Bitim boʻlmadi” arizasini beradi. Ariza asosli deb topilsa, komissiya balansga qaytariladi.',
          ],
        ],
      },
      {
        heading: '8. Tomonlarning majburiyatlari',
        body: [
          [
            'Ijrochi Platformaning ishlashini taʼminlaydi, kontaktlarni faqat bitimdan keyin ochadi va arizalarni koʻrib chiqadi.',
            'Foydalanuvchi Foydalanish shartlariga rioya qiladi, haqiqiy maʼlumot beradi va komissiyani toʻlaydi.',
            'Mol, uning holati va mol uchun toʻlov boʻyicha bitim sotuvchi va xaridor oʻrtasida tuziladi. Ijrochi bu bitimning tarafi emas.',
          ],
        ],
      },
      {
        heading: '9. Nizolar',
        body: [
          'Nizolar avval muzokara yoʻli bilan, murojaat orqali hal qilinadi. Kelishuvga erishilmasa, nizo Oʻzbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.',
        ],
      },
      {
        heading: '10. Ofertaning oʻzgarishi',
        body: [
          'Ijrochi ofertani oʻzgartirishi mumkin. Yangi tahrir shu sahifada eʼlon qilingan kundan kuchga kiradi va undan keyin eʼlon qilingan auksionlarga qoʻllanadi.',
          CONTACT,
        ],
      },
    ],
  },
};

export const LEGAL_ORDER: LegalSlug[] = ['terms', 'privacy', 'offer'];
