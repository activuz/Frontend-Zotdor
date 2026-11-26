// Zotdor Android app: a native shell around web.zotdor.uz (docs/ANDROID.md).
plugins {
    id("com.android.application") version "9.4.1" apply false
    // Applied by :app only when app/google-services.json is present (Firebase push).
    id("com.google.gms.google-services") version "4.4.2" apply false
}
