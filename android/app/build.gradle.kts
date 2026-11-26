plugins {
    id("com.android.application")
}

// Firebase is optional at build time: without app/google-services.json the app works, only
// push notifications are off. The file comes from the Firebase console (Android app
// "uz.zotdor.web") and is not committed.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val baseUrl = providers.gradleProperty("zotdor.baseUrl").getOrElse("https://web.zotdor.uz")

android {
    namespace = "uz.zotdor.web"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "uz.zotdor.web"
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "BASE_URL", "\"$baseUrl\"")
        manifestPlaceholders["appHost"] = baseUrl.substringAfter("://").substringBefore("/")
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("com.google.firebase:firebase-messaging:24.1.0")
}
