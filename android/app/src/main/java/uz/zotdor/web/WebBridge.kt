package uz.zotdor.web

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * `window.ZotdorAndroid` for the site (frontend/src/features/notifications/native.ts).
 * Only our own site may use it: every call checks the host of the page currently loaded.
 * JavaScript calls arrive on a background thread; UI work goes through the activity.
 */
class WebBridge(private val activity: MainActivity, private val web: WebView) {
    /** Updated by MainActivity on every page start (main thread), read here (binder thread). */
    @Volatile
    var pageHost: String? = null

    private fun trusted(): Boolean = pageHost == activity.appHost

    @JavascriptInterface
    fun getPushToken(): String = if (trusted()) PushStore.token(activity).orEmpty() else ""

    @JavascriptInterface
    fun notificationPermission(): String = if (trusted()) Notifier.permission(activity) else "denied"

    @JavascriptInterface
    fun requestNotificationPermission() {
        if (trusted()) activity.runOnUiThread { activity.requestNotificationPermission() }
    }

    @JavascriptInterface
    fun openNotificationSettings() {
        if (trusted()) activity.runOnUiThread { activity.openNotificationSettings() }
    }

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    /** Tell the page something changed: `window.addEventListener('zotdor-native', …)`. */
    fun emit(detail: JSONObject) {
        web.post {
            if (trusted()) {
                web.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('zotdor-native',{detail:$detail}))",
                    null,
                )
            }
        }
    }

    fun emitPushToken(token: String) = emit(JSONObject().put("type", "push-token").put("token", token))

    fun emitPermission() =
        emit(JSONObject().put("type", "notification-permission").put("value", Notifier.permission(activity)))
}
