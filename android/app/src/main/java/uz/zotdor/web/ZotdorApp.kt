package uz.zotdor.web

import android.app.Application

/** App start: notification channels exist before any push arrives, then the Firebase token. */
class ZotdorApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.createChannels(this)
        PushStore.refresh(this)
    }
}
