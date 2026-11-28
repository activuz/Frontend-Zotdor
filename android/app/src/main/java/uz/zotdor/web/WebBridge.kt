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

    // --- background uploads of the sell wizard (UploadStore, UploadWorker) ---------------------

    @JavascriptInterface
    fun uploadBegin(json: String): Boolean =
        trusted() && runCatching { UploadStore.begin(activity, JSONObject(json)) }.getOrDefault(false)

    @JavascriptInterface
    fun uploadAppend(id: String, base64: String): Boolean = trusted() && UploadStore.append(activity, id, base64)

    @JavascriptInterface
    fun uploadCommit(id: String): Boolean = trusted() && UploadStore.commit(activity, id)

    @JavascriptInterface
    fun uploads(auctionId: String): String = if (trusted()) UploadStore.list(activity, auctionId) else "[]"

    @JavascriptInterface
    fun uploadRetry(id: String, csrf: String) {
        if (trusted()) UploadStore.retry(activity, id, csrf)
    }

    @JavascriptInterface
    fun uploadRemove(id: String) {
        if (trusted()) UploadStore.remove(activity, id)
    }

    @JavascriptInterface
    fun submitWhenReady(json: String): Boolean =
        trusted() && runCatching { UploadStore.requestSubmit(activity, JSONObject(json)) }.getOrDefault(false)

    @JavascriptInterface
    fun pendingSubmit(auctionId: String): Boolean = trusted() && UploadStore.hasSubmit(activity, auctionId)

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
