package uz.zotdor.web

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

/**
 * The Firebase Cloud Messaging token of this install. The site (running in the WebView) reads it
 * through WebBridge and sends it to the server with the user's session (`POST /me/devices`).
 */
object PushStore {
    private const val PREFS = "push"
    private const val KEY_TOKEN = "fcm_token"

    /** MainActivity listens while it is open, to pass a new token to the page at once. */
    @Volatile
    var listener: ((String) -> Unit)? = null

    fun token(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, null)

    fun save(context: Context, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TOKEN, token).apply()
        listener?.invoke(token)
    }

    /** Firebase is optional (no google-services.json = no push); never crash without it. */
    fun refresh(context: Context) {
        if (FirebaseApp.getApps(context).isEmpty()) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            if (!token.isNullOrBlank() && token != token(context)) save(context, token)
        }
    }
}
