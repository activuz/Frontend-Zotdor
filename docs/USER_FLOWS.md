# Foydalanuvchi oqimlari — Zotdor.uz

Har bir oqim uchun asosiy yo‘l va muhim chetki holatlar keltirilgan. Biznes qoidalari (BR-xx) [PRD](PRD.md) da, endpointlar esa [API](API.md) da.

## Marshrutlar (frontend)

| Yo‘l | Ekran | Kirish talab qilinadimi |
|---|---|---|
| `/` | Feed | yo‘q |
| `/search` | Qidiruv va filtrlar (holat URL'da saqlanadi) | yo‘q |
| `/a/:id` | Auksion sahifasi | ko‘rish uchun yo‘q, taklif uchun ha |
| `/login` | Kirish | — |
| `/sell` | Qoralamalar va yangi auksion boshlash | ha |
| `/sell/:id?step=details\|time\|media\|review` | Auksion yaratish ustasi (qoralama serverda saqlanadi) | ha |
| `/a/:id/decision` | G‘olibni tanlash | ha (egasi) |
| `/deals/:id` | Bitim | ha (tomonlar) |
| `/me` | Profil menyusi | ha |
| `/me/auctions`, `/me/bids`, `/me/deals`, `/me/saved` | Ro‘yxatlar | ha |
| `/wallet` | Hamyon (`?payment=` — to‘lov holati, `?topup=` — tavsiya etilgan summa) | ha |
| `/wallet/test-payment/:id` | Faqat `fake` to‘lov provayderi uchun test sahifasi | ha |
| `/notifications` | Bildirishnomalar | ha |
| `/u/:id` | Ommaviy profil | yo‘q |
| `/legal/terms`, `/legal/privacy` | Huquqiy sahifalar | yo‘q |
| `*` | 404 | — |

## F1. Kirish

1. Foydalanuvchi kirish talab qiladigan amalni bosadi (taklif berish, sotish, saqlash) yoki "Kirish" tugmasini bosadi. Keyin `/login?next=…` sahifasiga o‘tadi.
2. Raqamni kiritadi. Maydon `+998` bilan boshlanadi va `90 123 45 67` ko‘rinishidagi niqobga ega.
3. "Telegram orqali tasdiqlash" tugmasini bosadi va Telegram ilovasi ochiladi (`deep_link`). Sahifada ko‘rsatma va qolgan vaqt (10 daqiqa) chiqadi.
4. Botda "Raqamni ulashish" tugmasi bosiladi.
5. Sayt har 2 soniyada holatni tekshiradi. Tasdiqlangach, foydalanuvchi `next` sahifasiga qaytadi.
6. Birinchi marta kirgan bo‘lsa, profilni to‘ldirish so‘raladi: ism, viloyat va tuman. Shu payt 50 000 so‘m bonus haqida xabar ko‘rsatiladi.

Chetki holatlar:
- **Raqam mos kelmadi.** Bot ham, sayt ham aniq sababni ko‘rsatadi: "Telegram'dagi raqamingiz +998 90 *** ** 67, siz boshqa raqam kiritdingiz."
- **Muddat tugadi.** "Qaytadan yuborish" tugmasi chiqadi.
- **Foydalanuvchi bloklangan.** Sabab va qo‘llab-quvvatlash kontakti ko‘rsatiladi.
- **Kompyuterda Telegram yo‘q.** Havolaning QR-kodi ko‘rsatiladi.

## Joylashuv

Foydalanuvchi nuqtasi ikki yo‘l bilan kiritiladi: "Joylashuvimni aniqlash" (brauzer geolokatsiyasi) yoki "Xaritadan tanlash" (to‘liq ekranli xarita, pin markazda). Kirgan foydalanuvchida nuqta profilga saqlanadi (`PUT /me/location`), mehmonda faqat shu tabda. Nuqta saqlanmagan bo‘lsa, bosh sahifa tepasida "Joylashuvingizni kiriting" eslatmasi chiqadi, uni shu sessiya uchun yopish mumkin. Profilda "Joylashuvim" bo‘limi nuqtani xaritada ko‘rsatadi, "Xaritada o‘zgartirish" va "O‘chirish" tugmalari bilan.

## F2. Auksion yaratish

1. **Ma'lumotlar.** Ketma-ket tanlanadi: yo‘nalish → tur → toifa → zot. Keyin yoshi (yil va oy), vazni hamda "taxminiy" belgisi, narx (raqamlar guruhlab ko‘rsatiladi: `25 000 000`), tavsif, joylashuv (standart: profildagi tuman) kiritiladi. Ixtiyoriy "Molning joylashuvi" bloki: "Xaritada belgilash" to‘liq ekranli xaritani ochadi (pin markazda turadi, xarita suriladi, "Mening joylashuvim" tugmasi), yoki "Profildagi joylashuvim" bir bosishda qo‘yadi. Nuqta tanlanganda viloyat va tuman avtomatik to‘ladi. Ostida izoh: xaridorlar faqat taxminiy hududni ko‘radi (BR-11a, BR-33a). Tavsif yozilayotganda kontakt yoki haqorat aniqlansa, darhol ogohlantiriladi.
2. **Vaqt.** "Hozir boshlash" yoki sana va vaqt tanlanadi. Davomiylik tayyor variantlardan tanlanadi (10 daq, 30 daq, 1, 2, 3, 6, 12 soat) yoki qo‘lda kiritiladi (10 daqiqadan 12 soatgacha). Ekranda tugash vaqti aniq ko‘rsatiladi: "Bugun 18:30 da tugaydi".
3. **Media.** Kamera oynasi ochiladi. Ekranda "Rasmlar 2/4, video 0/1" hisoblagichi va har bir kadr uchun qisqa ko‘rsatma turadi ("Molni yonidan, to‘liq ko‘rinadigan qilib oling"). Kamera ruxsati berilmagan bo‘lsa, brauzer bo‘yicha ruxsat berish yo‘riqnomasi chiqadi. Kompyuterda: "Iltimos, telefoningizdan davom eting" xabari va shu qoralamaga olib boradigan havola (nusxa olish tugmasi bilan) ko‘rsatiladi. QR-kod hali yo‘q: uning uchun yangi kutubxona kerak, qaror mahsulot egasida. Kompyuter kamerasidan foydalanish ikkinchi darajali tugma sifatida qoldirilgan. Olingan fayllar to‘rda turadi: faylni bosib turib (yoki tutqichdan ushlab) surib tartib o‘zgartiriladi, tutqich klaviaturada strelkalar bilan ham ishlaydi. Birinchi rasmda "Muqova" belgisi turadi. Faylga bosilsa, to‘liq ekranli ko‘ruvchi ochiladi (BR-12a).
4. **Ko‘rib chiqish.** Kartochka qanday ko‘rinishi va komissiya rezervi ko‘rsatiladi: "E'lon qilish uchun balansdan 50 000 so‘m vaqtincha band qilinadi". Mavjud balans ham shu yerda turadi. Balans yetmasa, "To‘ldirish" tugmasi chiqadi.
5. **Yuborish.** "Tekshirilmoqda…" holati, odatda bir necha soniya davom etadi. Natija uch xil bo‘lishi mumkin:
   - O‘tdi → "Auksion bugun 15:00 da boshlanadi" va auksion sahifasiga havola.
   - Moderatsiyada → "Moderator tekshiradi, odatda 1 soat ichida" (vaqtni mahsulot egasi tasdiqlaydi).
   - Rad etildi → tekshiruvlar ro‘yxati va har biri uchun tuzatish tugmasi ("Tavsifdagi telefon raqamini olib tashlang", "Yana 1 ta rasm oling").

Qoralama avtomatik saqlanadi. Foydalanuvchi chiqib ketsa, keyin davom ettira oladi.

## F3. Taklif berish

0. **Galereya.** Rasm va video svayp bilan yoki ikki yondagi oq dumaloq tugmalar bilan almashadi; yuqorida "2 / 5" hisoblagichi, pastda nuqtalar va eskizlar. Ko‘rinib turgan video Instagram'dagidek avtomatik, ovozsiz va takror ijro etiladi; boshqa slaydga o‘tilsa, sahifadan chiqib ketsa yoki tab yashirilsa, pauza qiladi. Videoga bosish ovozni yoqadi, ovoz tanlovi sessiya davomida saqlanadi. Brauzerda "trafikni tejash" yoqilgan bo‘lsa, video bosilgandagina yuklanadi. Rasmga bosilsa, to‘liq ekranli ko‘ruvchi ochiladi (Escape yoki ✕ bilan yopiladi). Nuqta belgilangan e'londa "Molning taxminiy joylashuvi" xaritasi (doira) va "Ulashish" tugmasi bor.
1. Auksion sahifasida rangli taklif ro‘yxati, qolgan vaqt sanog‘i va sotuvchi narxi ko‘rsatiladi.
2. Pastki panelda summa maydoni turadi. Tezkor tugmalar ham bor: "Eng yuqori + 100 000", "Sotuvchi narxi".
3. Tasdiqlash oynasi chiqadi: "23 500 000 so‘m taklif qilasiz. Oldingi taklifingiz (22 000 000) bekor bo‘ladi."
4. Taklif yuborilgach, ro‘yxatda foydalanuvchining qatori "Siz" deb belgilanadi va uning o‘rni ko‘rsatiladi ("Siz 2-o‘rindasiz").

Chetki holatlar: summa chegaradan tashqarida bo‘lsa, minimal va maksimal summa aniq ko‘rsatiladi. Auksion shu soniyada tugagan bo‘lsa, "Auksion tugadi, taklif qabul qilinmadi" deyiladi. Rate limit'da "Bir necha soniyadan keyin qayta urinib ko‘ring" deyiladi. Agar foydalanuvchi o‘z auksionini ochgan bo‘lsa, taklif paneli o‘rniga statistika ko‘rsatiladi.

Kim qanday xabar oladi: sotuvchiga birinchi taklif kelganda xabar beriladi, keyin ko‘pi bilan har 30 daqiqada bitta yig‘ma xabar. Xaridor 1-o‘rindan tushib qolsa, unga bir marta xabar beriladi.

## F4. Auksion yakuni va g‘olibni tanlash

1. `ends_at` vaqtida auksion `ended` holatiga o‘tadi. Sotuvchiga Telegram xabari keladi: "Auksion tugadi. 7 ta taklif. 48 soat ichida xaridorni tanlang."
2. Tanlash ekrani `/a/:id/decision`:
   - "Tavsiya" bloki: eng yuqori 3 ta va eng yaqin 3 ta taklif, ular "Eng yuqori" va "Eng yaqin" teglari bilan belgilangan.
   - Undan pastda barcha takliflar ro‘yxati, saralash: summa yoki masofa.
   - Har bir qatorda summa, masofa, reyting va bitimlar soni ko‘rinadi.
3. Taklifni tanlagach, tasdiqlash oynasi chiqadi: "Xaridor #4 ga 23 500 000 so‘mga sotasiz. Komissiya 47 000 so‘m balansingizdan yechiladi. Shundan keyin ikkalangizga ham kontaktlar ochiladi."
4. Bitim sahifasi ochiladi va xaridorga Telegram xabari boradi: "Taklifingiz qabul qilindi. Sotuvchi: …, telefon …".
5. Boshqa xaridorlarga "Auksion yakunlandi, taklifingiz tanlanmadi" xabari boradi.

**Muddatidan oldin sotish (BR-35).** Auksion boshlanganidan 10 daqiqa o‘tgach, sotuvchi o‘z auksioni sahifasida "Hozir sotish" tugmasini ko‘radi. Bu tugma xuddi shu tanlash ekranini ochadi. Tasdiqlash oynasida qo‘shimcha ogohlantirish chiqadi: "Auksion hozir yakunlanadi, boshqa takliflar qabul qilinmaydi." Boshqa xaridorlarga "Auksion muddatidan oldin yakunlandi" xabari yuboriladi.

Muqobil yo‘llar: "Hech birini tanlamayman" tugmasi auksionni `unsold` holatiga o‘tkazadi va rezervni qaytaradi. 48 soat o‘tsa, natija xuddi shunday bo‘ladi, muddat tugashidan 24 soat va 2 soat oldin eslatma yuboriladi. Taklif bo‘lmagan auksion darhol `unsold` bo‘ladi va "Qayta e'lon qilish" tugmasi chiqadi.

## F5. Bitimdan keyin

- **Bitim sahifasi:** ikkinchi tomonning ismi, telefoni ("Qo‘ng‘iroq qilish" tugmasi) va Telegram username'i (bo‘lsa), shuningdek narx va sana ko‘rsatiladi. Sotuvchi nuqta belgilagan bo‘lsa, "Mol joylashuvi" xaritasi va Yandex Xarita hamda Google Maps'da yo‘l ochish tugmalari chiqadi (BR-33a).
- **Baholash:** bitimdan 24 soat o‘tgach, ikkala tomonga eslatma boradi. Baho 14 kun ichida qoldiriladi.
- **"Bitim bo‘lmadi" arizasi** (faqat sotuvchi, 7 kun ichida): sabab yoziladi va ariza moderatorga tushadi. Natija Telegram orqali keladi. Ariza tasdiqlansa, komissiya qaytariladi va bitim `failed` holatiga o‘tadi.

## F6. Hamyon

- **Ekran:** mavjud summa katta qilib ko‘rsatiladi, ostida "Asosiy · Bonus (… gacha amal qiladi) · Band qilingan" yozuvi va operatsiyalar tarixi turadi. Har bir operatsiya tushunarli nomga ega, masalan "Komissiya — Qoramol · Buqa, 23 500 000 so‘mlik bitim".
- **To‘ldirish:** summa kiritiladi yoki tayyor variant tanlanadi (50 000, 100 000, 200 000). Click sahifasiga o‘tiladi, keyin hamyonga qaytiladi. Sahifa to‘lov holatini kuzatib turadi.
- **Pulni qaytarish arizasi:** summa, Click to‘lov raqami va sabab kiritiladi. Ariza holati ro‘yxatda ko‘rinadi.
- **Manfiy balans:** ekranning yuqorisida "Qarzni yoping: 12 000 so‘m. Shundan keyin yangi auksion ocha olasiz" degan ogohlantirish turadi.

## F7. Moderator (panel)

1. **Navbat:** moderatsiyadagi auksionlar eng eskisidan boshlab ko‘rsatiladi. Har birida ogohlantirish bergan tekshiruvlar, media, sotuvchi tarixi (oldingi auksionlar, shikoyatlar) bor.
2. **Amallar:** "Tasdiqlash", "Rad etish" (sabab ro‘yxatdan tanlanadi va qo‘shimcha izoh yoziladi; sabab foydalanuvchiga ko‘rinadi), "Bloklash".
3. **Boshqa navbatlar:** shikoyatlar, "bitim bo‘lmadi" arizalari, pul qaytarish arizalari. Har birida bir xil tuzilma: ma'lumot → qaror → izoh.
4. **Foydalanuvchi kartasi:** profil, auksionlar, takliflar, bitimlar, hamyon (faqat ko‘rish; admin tuzata oladi), audit tarixi.

## F8. Bildirishnomalar matrisasi

| Hodisa | Kimga | Telegram | Ilova ichida |
|---|---|---|---|
| Auksion e'lon qilindi, moderatsiyada yoki rad etildi | sotuvchi | ✓ | ✓ |
| Auksion boshlandi | sotuvchi, kuzatuvchilar | ✓ | ✓ |
| Birinchi taklif yoki yig‘ma xabar | sotuvchi | ✓ | ✓ |
| 1-o‘rindan tushib qoldingiz | xaridor | ✓ | ✓ |
| Auksion tugashiga 10 daqiqa qoldi | kuzatuvchilar, taklif berganlar | ✓ | — |
| Auksion tugadi, xaridorni tanlang | sotuvchi | ✓ | ✓ |
| Taklifingiz qabul qilindi yoki tanlanmadi | xaridorlar | ✓ | ✓ |
| Baholashni eslatish | tomonlar | ✓ | ✓ |
| Ariza natijasi | ariza beruvchi | ✓ | ✓ |
| Balans to‘ldirildi | foydalanuvchi | ✓ | ✓ |
| Bonus 7 kundan keyin yonadi | foydalanuvchi | ✓ | ✓ |
