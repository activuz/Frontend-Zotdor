# PRD — Zotdor.uz

Holat: **qoralama v0.1** (2026-11-20). Discovery suhbati asosida yozilgan. "Taxmin" (A-xx) deb belgilangan bandlar mahsulot egasi tasdiqlashini kutmoqda.

## 1. Mahsulot nima

Zotdor — chorva mollarini **faqat auksion shaklida** sotish platformasi. Sotuvchi o‘z narxini aytadi va auksion vaqtini belgilaydi. Xaridorlar narx taklif qiladi, xuddi bozordagi savdolashuv kabi. Auksion tugagach, sotuvchi takliflardan birini o‘zi tanlaydi. Platforma xaridor va sotuvchi o‘rtasidagi to‘lovga aralashmaydi. U faqat sotuvchidan komissiya oladi va bu pul sotuvchining platformadagi balansidan yechiladi.

## 2. Maqsadlar va o‘lchovlar

| Maqsad | Ko‘rsatkich |
|---|---|
| Sotuvchilar auksion ochadi | haftasiga e'lon qilingan auksionlar soni |
| Auksionlar bitim bilan tugaydi | tugagan auksionlarda qabul qilingan taklif ulushi |
| Platforma daromad oladi | yechilgan komissiya summasi (bonusdan tashqari) |
| Ishonch | tasdiqlangan "bitim bo‘lmadi" arizalari ulushi, shikoyatlar soni |
| Tezkor savdo | auksion tugashidan taklif qabul qilinguncha o‘tgan o‘rtacha vaqt |

## 3. Doiradan tashqarida (hozircha yoki hechqachon qilinmaydi)

- OLX uslubidagi oddiy e'lonlar (har bir sotuv auksion orqali bo‘ladi)
- Veterinariya pasporti integratsiyasi
- so‘m/kg narx tahlili
- Ko‘p tillilik. Interfeys faqat o‘zbek tilida, lotin yozuvida
- Xaridor → sotuvchi to‘lovini platforma orqali o‘tkazish (escrow)
- Balansdan pulni avtomatik yechib olish (payout)
- Aniq pozada suratga olishni talab qiladigan AI (keyingi bosqich, §9 ga qarang)

## 4. Foydalanuvchi rollari

| Rol | Kim | Asosiy vazifa |
|---|---|---|
| Foydalanuvchi | chorvador, fermer, qassob, oddiy xaridor | Bir akkaunt bilan ham sotadi, ham sotib oladi |
| Moderator | platforma xodimi | Shubhali auksionlarni tekshiradi, shikoyatlar, "bitim bo‘lmadi" va pul qaytarish arizalarini ko‘rib chiqadi |
| Admin | platforma egasi yoki texnik rahbar | Moderatorning barcha huquqlari, hamda sozlamalar, toifalar, xodimlar va balansni qo‘lda tuzatish |

## 5. Biznes qoidalari

### Kirish
- **BR-01** Kirish faqat telefon raqami va Telegram bot orqali bo‘ladi. Botda ulashilgan kontakt shu Telegram akkauntning o‘ziga tegishli bo‘lishi va saytda kiritilgan raqamga mos kelishi shart.
- **BR-02** Bitta telefon raqami = bitta akkaunt = bitta Telegram akkaunt.
- **BR-03** Faqat +998 raqamlar qabul qilinadi. *(A-18)*

### Auksion
- **BR-10** Har bir sotuv auksion orqali bo‘ladi. Bitta auksion = bitta hayvon. *(A-01)*
- **BR-11** Sotuvchi quyidagilarni kiritadi: yo‘nalish, hayvon turi, jins-yosh toifasi, zot (ixtiyoriy), yoshi, vazni (taxminiy yoki aniq), tavsif, so‘raladigan narx, joylashuv (viloyat, tuman), boshlanish sanasi va vaqti, davomiylik.
- **BR-12** Davomiylik **10 daqiqadan 12 soatgacha** bo‘ladi.
- **BR-13** Boshlanish vaqti "hozir" yoki kelajakdagi istalgan vaqt bo‘lishi mumkin, lekin ko‘pi bilan 7 kun oldinga. *(A-02)*
- **BR-14** Media faqat ilova ichidagi kamera orqali olinadi. Kamida **4 ta rasm** (ko‘pi bilan 10 ta) va kamida **1 ta video** talab qilinadi. Galereyadan yuklab bo‘lmaydi.
- **BR-15** Auksion sarlavhasini tizim tanlangan maydonlardan o‘zi tuzadi, masalan "Qoramol · Buqa · Semental · 3 yosh". *(A-08)*
- **BR-16** Tavsifda telefon raqami, Telegram username, havola yoki haqorat bo‘lishi mumkin emas. Bu avtomatik tekshiriladi.
- **BR-17** Avtomatik tekshiruvdan o‘tgan auksion darhol e'lon qilinadi. Natijasi noaniq bo‘lsa, moderator navbatiga tushadi. Aniq qoidabuzarlikda rad etiladi va sababi ko‘rsatiladi.
- **BR-18** Bekor qilish: auksionni boshlanishidan oldin istalgan payt bekor qilish mumkin. Jonli auksionni esa faqat hali taklif bo‘lmagan bo‘lsa bekor qilish mumkin. *(A-03)*
- **BR-19** Kategoriyalar uch darajali: **yo‘nalish** (Go‘sht, Sut-tuxum, Ko‘rkam, Sport-transport, Pet), **hayvon turi** (qoramol, qo‘y, echki, ot…), **jins-yosh toifasi** (buzoq, tana, gʻunajin, sigir, ho‘kiz, buqa…). Bitta tur bir nechta yo‘nalishga tegishli bo‘lishi mumkin. Ro‘yxatlarni admin paneldan tahrirlash mumkin. Boshlang‘ich ro‘yxatni mahsulot egasi tasdiqlaydi.

### Takliflar
- **BR-20** Taklif faqat jonli auksionga, faqat tizimga kirgan va bloklanmagan foydalanuvchi tomonidan beriladi. Sotuvchi o‘z auksioniga taklif bera olmaydi.
- **BR-21** Taklif sotuvchi narxidan past bo‘lishi mumkin, lekin **sotuvchi narxining 50% idan kam bo‘lmasligi** kerak.
- **BR-22** Taklifning yuqori chegarasi: sotuvchi narxining 3 baravari. Bu trol takliflardan himoya. *(A-05)*
- **BR-23** Bitta xaridor bir necha marta taklif bera oladi. Har yangi taklifda uning oldingi taklifi **nofaol** bo‘ladi, ya'ni har bir xaridorda bitta faol taklif bo‘ladi. Yangi taklif oldingisidan past bo‘lishi ham mumkin. *(A-06)*
- **BR-24** Xaridorlar ismi yashiriladi. Ular auksion ichida "Xaridor #N" deb ko‘rsatiladi va bu raqam o‘zgarmaydi.
- **BR-25** Ommaviy ro‘yxat faqat faol takliflardan iborat va summa bo‘yicha kamayish tartibida turadi (teng summada avval berilgani yuqorida). O‘rin bo‘yicha rang: **1-o‘rin yashil, 2–3-o‘rin sariq, 4-o‘rindan boshlab qizil**.
- **BR-26** Bitta foydalanuvchi bitta auksionga 10 soniyada ko‘pi bilan bitta taklif bera oladi.

### Auksion yakuni va bitim
- **BR-30** Auksion tugagach, sotuvchi **48 soat** ichida bitta taklifni qabul qiladi yoki hammasini rad etadi. Muddat o‘tsa, auksion "sotilmadi" holatiga o‘tadi. *(A-04)*
- **BR-31** Sotuvchi istalgan faol taklifni tanlay oladi. Tanlash oynasida **eng yuqori 3 ta** va **eng yaqin 3 ta** taklif "Tavsiya" bloki sifatida yuqorida turadi. Qolganlarini summa yoki masofa bo‘yicha saralash mumkin.
- **BR-32** Tanlash oynasida sotuvchi har bir xaridorning summasi, masofasi, reytingi va bitimlar sonini ko‘radi. Ism va telefon ko‘rinmaydi.
- **BR-33** Taklif qabul qilinganda bitim yaratiladi, komissiya yechiladi va **shundan keyingina** ikki tomonga bir-birining ismi va telefoni ochiladi.
- **BR-35** Sotuvchi jonli auksionda ham faol taklifni qabul qila oladi, lekin **auksion boshlanganidan kamida 10 daqiqa o‘tgach**. Bunda auksion darhol `sold` holatiga o‘tadi va boshqa xaridorlarga "Auksion muddatidan oldin yakunlandi" xabari boradi. Komissiya va kontaktlarni ochish BR-33 bo‘yicha amalga oshadi.
- **BR-34** Sotuvchi bitim yaratilganidan keyin 7 kun ichida "bitim bo‘lmadi" arizasini bera oladi. Moderator ariza asosli deb topsa, komissiya balansga qaytariladi. *(A-09)*

### Pul
- **BR-40** Komissiya: **qabul qilingan taklif summasining 0.2%**, butun so‘mgacha yuqoriga yaxlitlanadi. Uni faqat sotuvchi to‘laydi. Stavka sozlamada saqlanadi, e'lon qilish paytida auksionga yoziladi va keyin o‘zgarmaydi. *(A-11)*
- **BR-41** Auksionni e'lon qilish uchun sotuvchining mavjud balansida sotuvchi narxining 0.2% i bo‘lishi kerak. Bu summa **rezerv** qilinadi. Bitim bo‘lsa, haqiqiy komissiya yechiladi va qolgani rezervdan qaytadi. Bitim bo‘lmasa yoki auksion bekor qilinsa, rezerv to‘liq qaytadi.
- **BR-42** Haqiqiy komissiya rezervdan katta bo‘lsa (taklif narxdan yuqori bo‘lgan holat), farq balansdan yechiladi. Balans yetmasa, asosiy balans manfiyga tushadi. Qarz yopilmaguncha foydalanuvchi yangi auksion ocha olmaydi. *(A-12)*
- **BR-43** Yangi akkauntga **50 000 so‘m bonus** beriladi. Bonus faqat komissiyaga sarflanadi, naqd qilib bo‘lmaydi va 90 kundan keyin yonib ketadi. Komissiya avval bonusdan, keyin asosiy balansdan yechiladi. *(A-10)*
- **BR-44** Asosiy balans faqat Click orqali to‘ldiriladi. Click shartnomasi tuzilmaguncha admin balansni qo‘lda to‘ldira oladi va bu audit jurnaliga yoziladi.
- **BR-45** Balansdan pul yechish funksiyasi yo‘q. Foydalanuvchi "pulni qaytarish" arizasini beradi (summa, Click to‘lov raqami, sabab). Moderator pulni Click kabineti orqali qo‘lda qaytaradi va arizani yopadi. Shundan keyin summa balansdan ayiriladi.
- **BR-46** Har bir pul harakati o‘zgarmas jurnal yozuvi (ledger) sifatida saqlanadi. Balans faqat shu jurnal orqali o‘zgaradi.

### Reyting
- **BR-50** Bitimdan keyin 14 kun ichida ikki tomon bir-birini 1–5 ball bilan baholaydi va ixtiyoriy izoh yozadi. Har bir tomon bitim uchun bitta baho qoldiradi. *(A-09)*
- **BR-51** Profilda o‘rtacha baho, baholar soni va yakunlangan bitimlar soni ko‘rsatiladi.

### Xavfsizlik va moderatsiya
- **BR-60** Foydalanuvchi auksion yoki foydalanuvchi ustidan shikoyat qila oladi. *(A-14)*
- **BR-61** Moderator auksionni bloklay oladi. Bloklangan auksionning rezervi qaytadi va faol takliflari bekor bo‘ladi. Moderator foydalanuvchini ham bloklay oladi: bloklangan foydalanuvchi taklif bera olmaydi va auksion ocha olmaydi.
- **BR-62** Xodimlarning har bir harakati audit jurnaliga yoziladi.

## 6. Funksional talablar (MVP)

| ID | Talab | BR |
|---|---|---|
| FR-01 | Telegram bot orqali kirish va chiqish | 01–03 |
| FR-02 | Profil: ism, viloyat, tuman, ixtiyoriy geolokatsiya. Ommaviy profilda reyting va bitimlar | 51 |
| FR-03 | Auksion yaratish ustasi: maydonlar → kamera orqali media → ko‘rib chiqish → yuborish | 11–17 |
| FR-04 | Media qayta ishlash: rasm o‘lchamini kichraytirish, metama'lumotni olib tashlash, video transkod, dublikatni aniqlash | 14 |
| FR-05 | Avtomatik tekshiruv (matn, media) va natijani foydalanuvchiga tushuntirish | 16–17 |
| FR-06 | Asosiy feed: "Tez orada tugaydi", "Yaqiningizda", "Eng faol", "Tez orada boshlanadi" bo‘limlari | — |
| FR-07 | Qidiruv va filtrlar: yo‘nalish, tur, toifa, zot, viloyat, narx, holat. Saralash: yaqin, tugashiga oz qolgan, eng faol, yangi, narx | — |
| FR-08 | Auksion sahifasi: media, xususiyatlar, rangli taklif ro‘yxati, qolgan vaqt sanog‘i, taklif berish | 20–26 |
| FR-09 | Sotuvchining tanlash oynasi va taklifni qabul qilish yoki hammasini rad etish | 30–33 |
| FR-10 | Bitim sahifasi: kontaktlar, "bitim bo‘lmadi" arizasi, baholash | 33–34, 50 |
| FR-11 | Hamyon: balans (asosiy, bonus, rezerv), operatsiyalar tarixi, Click orqali to‘ldirish, pul qaytarish arizasi | 40–46 |
| FR-12 | Bildirishnomalar: Telegram orqali va ilova ichida | — |
| FR-13 | Saqlanganlar: auksionni kuzatish, boshlanishi va tugashi haqida xabar olish *(A-15)* | — |
| FR-14 | Shikoyat qilish | 60 |
| FR-15 | Mening auksionlarim, Mening takliflarim, Mening bitimlarim | — |
| FR-16 | Panel: moderatsiya navbati, shikoyatlar, arizalar, foydalanuvchilar, balansni tuzatish, sozlamalar, toifalar, audit jurnali, asosiy statistika | 44–45, 61–62 |
| FR-17 | Huquqiy sahifalar: foydalanish shartlari (oferta), maxfiylik siyosati. **Matnni mahsulot egasi yoki yurist beradi** | — |

## 7. Nofunksional talablar

- **NFR-01 Mobil birinchi.** Asosiy ekran 360 px kenglikda to‘liq ishlaydi. Sekin 3G'da feed 4 soniyada ko‘rinadi.
- **NFR-02 Tezlik.** API p95 < 400 ms (media yuklashdan tashqari). Yangi taklif boshqa foydalanuvchilarga ≤ 5 soniyada ko‘rinadi.
- **NFR-03 To‘g‘rilik.** Taklif berish va pul operatsiyalari tranzaksiya ichida bajariladi. Tugagan auksionga taklif hech qanday holatda qabul qilinmaydi, hatto rejalashtiruvchi kechiksa ham.
- **NFR-04 Vaqt.** Hammasi UTC'da saqlanadi va `Asia/Tashkent` vaqtida ko‘rsatiladi.
- **NFR-05 Xavfsizlik.** Sessiya httpOnly va Secure cookie'da, CSRF himoyasi bilan. Rate limit qo‘yiladi. Fayl turi tekshiriladi. Maxfiy kalitlar faqat env'da saqlanadi (§ ARCHITECTURE).
- **NFR-06 Shaxsiy ma'lumotlar.** O‘zbekiston fuqarolarining shaxsiy ma'lumotlari O‘zbekistondagi serverda saqlanishi kerak. Server joylashuvi yurist bilan tasdiqlanadi.
- **NFR-07 Accessibility.** Asosiy matn ≥ 15 px, yordamchi matn ≥ 13 px. Teginish maydoni ≥ 44 px. Rang yagona signal emas: taklif o‘rni raqam bilan ham ko‘rsatiladi.
- **NFR-08 Zaxira nusxa.** Ma'lumotlar bazasi har kuni, media esa serverdan tashqariga zaxiralanadi.

## 8. Taxminlar

| ID | Taxmin | Holat |
|---|---|---|
| A-01 | Bitta auksion = bitta hayvon. Qo‘ylarni to‘da bilan sotish qo‘llab-quvvatlanmaydi | ✅ tasdiqlandi ("hozircha") |
| A-02 | Boshlanishni ko‘pi bilan 7 kun oldinga belgilash mumkin | ✅ |
| A-03 | Jonli auksionni faqat hali taklif bo‘lmasa bekor qilish mumkin | ✅ |
| A-04 | G‘olibni tanlash uchun 48 soat beriladi | ✅ 48 soat tasdiqlandi. Muddatidan oldin qabul qilish ham ruxsat etiladi, boshlanishdan 10 daqiqa o‘tgach (BR-35) |
| A-05 | Taklif sotuvchi narxining 3 baravaridan oshmaydi | ✅ |
| A-06 | Qayta berilgan taklif oldingisidan past bo‘lishi mumkin | ✅ |
| A-08 | Sarlavha avtomatik tuziladi | taxmin |
| A-09 | "Bitim bo‘lmadi" arizasi 7 kun ichida, baho 14 kun ichida beriladi | taxmin |
| A-10 | Bonus 50 000 so‘m, 90 kun amal qiladi, naqd qilib bo‘lmaydi | ✅ |
| A-11 | Komissiya butun so‘mgacha yuqoriga yaxlitlanadi | taxmin |
| A-12 | Komissiya rezervdan oshsa, asosiy balans manfiyga tushishi mumkin | ✅ |
| A-14 | Shikoyat funksiyasi MVP'da bor | ✅ |
| A-15 | "Saqlanganlar" (kuzatish) MVP'da bor | ✅ |
| A-18 | Faqat O‘zbekiston raqamlari qabul qilinadi | taxmin |

## 9. Keyingi bosqichlar (MVP'dan keyin)

1. **Yo‘naltirilgan suratga olish.** Hayvon turiga qarab aniq pozalar talab qilinadi (yon, old, orqa, tish). Qurilmadagi model (MediaPipe va shunga o‘xshash) kadrni real vaqtda baholaydi, server esa tekshiradi. MVP'dagi media tekshiruv interfeysi shu modelni ulashga tayyorlab qo‘yiladi (§ ARCHITECTURE, "Media tekshiruvi").
2. Pullik xizmatlar: TOP'ga chiqarish, auksion muddatiga bog‘liq to‘lov.
3. "Bitim bo‘lmadi" arizasidan keyin zaxiradagi taklifni tanlash.
4. Real vaqtli takliflar (WebSocket).
5. Telegram Mini App.
