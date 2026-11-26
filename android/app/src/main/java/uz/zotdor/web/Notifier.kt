package uz.zotdor.web

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Notification channels and drawing (FR-21). Channel ids match the backend's `fcm_channel()`. */
object Notifier {
    private data class Channel(val id: String, val name: Int, val description: Int, val importance: Int)

    private val channels = listOf(
        Channel("bids", R.string.channel_bids, R.string.channel_bids_desc, NotificationManager.IMPORTANCE_HIGH),
        Channel("auctions", R.string.channel_auctions, R.string.channel_auctions_desc, NotificationManager.IMPORTANCE_HIGH),
        Channel("deals", R.string.channel_deals, R.string.channel_deals_desc, NotificationManager.IMPORTANCE_HIGH),
        Channel("wallet", R.string.channel_wallet, R.string.channel_wallet_desc, NotificationManager.IMPORTANCE_DEFAULT),
        Channel("general", R.string.channel_general, R.string.channel_general_desc, NotificationManager.IMPORTANCE_DEFAULT),
    )
    private val channelIds = channels.map { it.id }.toSet()

    private const val PREFS = "notifications"
    private const val KEY_ASKED = "permission_asked"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            channels.map { c ->
                NotificationChannel(c.id, context.getString(c.name), c.importance).apply {
                    description = context.getString(c.description)
                    enableVibration(true)
                    lightColor = ContextCompat.getColor(context, R.color.brand)
                }
            },
        )
    }

    fun markAsked(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ASKED, true).apply()
    }

    /** "granted", "denied" or "default" (never asked yet), like the browser Notification API. */
    fun permission(context: Context): String {
        if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            if (Build.VERSION.SDK_INT < 33 || hasPostPermission(context)) return "granted"
        }
        if (Build.VERSION.SDK_INT >= 33 && !hasPostPermission(context)) {
            val asked = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ASKED, false)
            return if (asked) "denied" else "default"
        }
        return "denied"
    }

    private fun hasPostPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    fun show(context: Context, data: Map<String, String>) {
        val title = data["title"].orEmpty()
        if (title.isBlank() || !hasPostPermission(context)) return
        val body = data["body"].orEmpty()
        val tag = data["tag"] ?: title
        val channel = data["channel"]?.takeIf { it in channelIds } ?: "general"

        val open = Intent(context, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_URL, data["url"] ?: "/notifications")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val tap = PendingIntent.getActivity(
            context,
            tag.hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(tap)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setShowWhen(true)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(tag, 0, notification)
        } catch (_: SecurityException) {
            // Permission revoked between the check and the call.
        }
    }
}
