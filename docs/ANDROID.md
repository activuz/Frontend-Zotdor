# Android ilova (`android/`)

Holat: v1.0.0 (2026-11-26). Talab: FR-21. Qaror: [ARCHITECTURE.md D-12](ARCHITECTURE.md).

Ilova — `web.zotdor.uz` ni ochadigan native qobiq (Kotlin). Sayt WebView ichida ishlaydi, uning atrofidagi hamma narsa native: splash, internet yo‘q ekrani, ruxsatlar, bildirishnomalar, havolalar. Sayt yangilansa ilova ham yangilanadi; Play Store’ga faqat `android/` o‘zgarganda qayta chiqariladi.

| | |
|---|---|
| Paket | `uz.zotdor.web` |
| Nomi | Zotdor |
| Android | 7.0+ (minSdk 24), target 37 |
| Yig‘ish | Android Studio yoki `./gradlew assembleDebug` (JDK 17+; Android Studio’ning `jbr` i yetadi) |
| Sayt manzili | `gradle.properties` → `zotdor.baseUrl` (sinov uchun `-Pzotdor.baseUrl=…`) |

## Nima qiladi

- **Internet yo‘q ekrani** — ilova ichiga joylangan, birinchi ochilishda ham ishlaydi. Aloqa tiklanishi bilan sahifa o‘zi qayta yuklanadi. Saytdagi service worker ilova ichida ro‘yxatdan o‘tmaydi (`native.ts`), shuning uchun xatoni har doim ilova ko‘radi.
- **Bildirishnomalar** — Firebase Cloud Messaging. Server faqat `data` xabar yuboradi (`send_fcm`), bildirishnomani ilovaning o‘zi chizadi: ilova ikonkasi, brend rangi, kanal, bosilganda kerakli sahifa (ilova yopiq bo‘lsa ham). Kanallar (foydalanuvchi telefon sozlamalarida alohida o‘chira oladi): Takliflar, Auksionlar, Bitimlar, Hamyon, Umumiy. Turi → kanal: `notifications.services.fcm_channel`.
- **Ruxsatlar** — sayt so‘raganda Android oynasi chiqadi: joylashuv (`navigator.geolocation`), kamera (`getUserMedia`, faqat video, faqat o‘z saytimiz), bildirishnoma (Android 13+: birinchi ochilishda bir marta, keyin faqat profildagi "Bildirishnomalar" qatoridan). Rad etilsa — tushuntirish va sozlamalarga yo‘l.
- **Havolalar** — `web.zotdor.uz` ichidagilar ilovada; `tel:`, Telegram, Yandex/Google xarita va boshqa saytlar o‘z ilovasida. `web.zotdor.uz` havolasi boshqa ilovadan (Telegram, SMS, xabarlar) bosilsa ilova ochiladi (App Links): bosh sahifa, `/a/`, `/u/`, `/deals/`, `/me`, `/notifications`, `/search`, `/sell`, `/wallet`, `/app/`. `/login` ataylab kiritilmagan: brauzerda boshlangan kirish o‘sha brauzerda tugashi kerak. Chrome manzil qatoriga yozilgan yoki saytning o‘z ichidagi havolalar App Link’ni ishga tushirmaydi — bu Android’ning odatiy xatti-harakati.
- **Ilova hissi** — splash (logo), status va navigatsiya paneli sayt sarlavhasi rangida, "orqaga" tugmasi sahifalar bo‘yicha, sahifa tepasida pastga tortib yangilash, yuqorida yuklanish chizig‘i, burilishda sahifa qayta yuklanmaydi.

## Sayt bilan aloqa (`window.ZotdorAndroid`)

`WebBridge.kt` ↔ `frontend/src/features/notifications/native.ts`. Har bir chaqiruv sahifa o‘z saytimizdan ekanini tekshiradi.

| Metod | Natija |
|---|---|
| `getPushToken()` | Firebase tokeni yoki `""` |
| `notificationPermission()` | `granted` \| `denied` \| `default` |
| `requestNotificationPermission()` | Android ruxsat oynasi yoki sozlamalar |
| `openNotificationSettings()` | ilovaning bildirishnoma sozlamalari |
| `appVersion()` | `1.0.0` |

Ilova sahifaga `zotdor-native` hodisasini yuboradi: `{type: "push-token", token}` va `{type: "notification-permission", value}`. Sayt tokenni foydalanuvchi sessiyasi bilan `POST /me/devices` ga yuboradi, chiqishda `DELETE /me/devices`. User-Agent oxirida `ZotdorApp/<versiya>` turadi.

## Firebase’ni ulash

1. Firebase console → loyiha → **Add app → Android**, paket `uz.zotdor.web`.
2. Yuklangan **`google-services.json`** ni `android/app/` ga qo‘ying. Bu mijoz konfiguratsiyasi; u `.gitignore` da, commit qilinmaydi. Fayl bo‘lmasa ilova yig‘iladi va ishlaydi, faqat push bo‘lmaydi.
3. Server uchun **service account** kaliti (Project settings → Service accounts → Generate new private key) — bu maxfiy kalit. JSON’ni bitta qiymat sifatida Render’dagi `zotdor-backend` guruhiga `FIREBASE_SERVICE_ACCOUNT_JSON` nomi bilan kiriting. Hech qachon frontend env’iga (Vercel) yoki repo’ga qo‘ymang.

Ikkala fayl **bitta Firebase loyihasidan** bo‘lishi shart: ilova tokeni boshqa loyihaning kaliti bilan yuborilsa, `SENDER_ID_MISMATCH` xatosi bo‘ladi va token o‘chiriladi.

## App Links tekshiruvi

Android `assetlinks.json` ni ilova **o‘rnatilayotganda** tekshiradi. Fayl keyin deploy qilingan bo‘lsa yoki imzo boshqa bo‘lsa, havolalar brauzerda ochiladi. Telefon ulangan holda:

```
adb shell pm verify-app-links --re-verify uz.zotdor.web
adb shell pm get-app-links uz.zotdor.web      # kutilgan natija: web.zotdor.uz: verified
```

Yoki ilovani o‘chirib qayta o‘rnating. Qo‘lda: Sozlamalar → Ilovalar → Zotdor → "Standart bo‘yicha ochish" → "Qo‘llab-quvvatlanadigan havolalarni ochish" yoqilgan va `web.zotdor.uz` belgilangan bo‘lsin.

## Chiqarish (release)

1. Android Studio → Build → Generate Signed App Bundle → yangi imzo kaliti (`.jks`). Kalit va parollarni xavfsiz joyda saqlang: yo‘qolsa, ilovani yangilab bo‘lmaydi. Play App Signing yoqilsa, Google ham nusxasini saqlaydi.
2. **App Links**: imzo kalitining SHA-256 barmoq izini (`keytool -list -v -keystore zotdor.jks` yoki Play Console → App integrity) `frontend/public/.well-known/assetlinks.json` ga yozing va saytni deploy qiling:
   ```json
   [{"relation": ["delegate_permission/common.handle_all_urls"],
     "target": {"namespace": "android_app", "package_name": "uz.zotdor.web",
                "sha256_cert_fingerprints": ["AA:BB:…"]}}]
   ```
3. `versionCode` ni har chiqarishda oshiring (`app/build.gradle.kts`).

## Qo‘lda sinov ro‘yxati

- Samolyot rejimida birinchi ochish → "Internet aloqasi yo‘q"; internet yoqilganda sahifa o‘zi ochiladi.
- Kirish (Telegram) → profil → "Bildirishnomalarni yoqish" → Android oynasi → ruxsat → bildirishnoma ilova yopiq holatda keladi, bosilganda sahifa ochiladi.
- Xaritada "Mening joylashuvim", sotish ustasida kamera: ruxsat oynalari, rad etilganda xabar.
- Telefon raqami, Telegram, "Yandex Xaritada yo‘l" tashqi ilovada ochiladi.
- "Orqaga" sahifalar bo‘yicha qaytadi; bosh sahifada ilovadan chiqadi.
- Chiqish → shu telefonga bildirishnomalar kelmaydi.
