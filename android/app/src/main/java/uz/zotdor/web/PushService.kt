package uz.zotdor.web

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives pushes even when the app is closed. The server sends data-only messages
 * (backend/notifications/services.py send_fcm), so the notification is always drawn here:
 * app icon, its channel and the page to open.
 */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        PushStore.save(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (data.isNotEmpty()) {
            Notifier.show(this, data)
        } else {
            // A console test message: show its notification part.
            message.notification?.let { n ->
                Notifier.show(this, mapOf("title" to (n.title ?: ""), "body" to (n.body ?: "")))
            }
        }
    }
}
