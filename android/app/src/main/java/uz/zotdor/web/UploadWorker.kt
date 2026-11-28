package uz.zotdor.web

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Sends the sell wizard's files in the background (UploadStore), keeps going after the app is
 * closed, then does a requested "Eʼlon qilish" once every file is on the server and processed.
 * Requests carry the WebView's cookies and the site's CSRF token, exactly like the page would.
 * Network or server trouble: Result.retry() (WorkManager backs off). A 4xx answer is final:
 * the file is marked failed with the server's Uzbek message and the page offers retry or delete.
 */
class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private sealed interface Outcome {
        data class Ok(val body: JSONObject) : Outcome
        data class Final(val message: String) : Outcome
        data object Retry : Outcome
    }

    override suspend fun getForegroundInfo(): ForegroundInfo = foreground(0)

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val context = applicationContext
        UploadStore.resetInterrupted(context)
        try {
            setForeground(foreground(UploadStore.all(context).count { it.state == UploadStore.QUEUED }))
        } catch (_: Exception) {
            // Not allowed from the background on newer Android: run as normal work instead.
        }

        while (true) {
            val item = UploadStore.next(context) ?: break
            UploadStore.setState(context, item.id, UploadStore.UPLOADING)
            UploadEvents.changed(item.auctionId)
            when (val outcome = upload(item)) {
                is Outcome.Ok -> UploadStore.remove(context, item.id)
                is Outcome.Final -> {
                    UploadStore.setState(context, item.id, UploadStore.FAILED, outcome.message)
                    UploadEvents.changed(item.auctionId)
                }
                Outcome.Retry -> {
                    UploadStore.setState(context, item.id, UploadStore.QUEUED)
                    UploadEvents.changed(item.auctionId)
                    return@withContext Result.retry()
                }
            }
        }

        var again = false
        for (request in UploadStore.submits(context)) {
            if (!submitIfReady(request)) again = true
        }
        if (again) Result.retry() else Result.success()
    }

    // --- files ------------------------------------------------------------------------------------

    private fun upload(item: UploadStore.Item): Outcome {
        val json = item.json
        val file = UploadStore.data(applicationContext, item.id)
        if (!file.exists()) return Outcome.Final("Fayl telefonda topilmadi. Qaytadan oling.")
        val boundary = "zotdor-" + UUID.randomUUID()
        fun field(name: String, value: String) =
            "--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray()
        val head = field("kind", json.getString("kind")) +
            field("capture_session_id", json.optString("sessionId")) +
            field("client_meta", json.optString("meta").ifBlank { "{}" }) +
            (
                "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"${json.optString("fileName")}\"\r\n" +
                    "Content-Type: ${json.optString("mime").ifBlank { "application/octet-stream" }}\r\n\r\n"
                ).toByteArray()
        val tail = "\r\n--$boundary--\r\n".toByteArray()
        val url = "${json.getString("apiOrigin")}/api/v1/auctions/${item.auctionId}/media"
        return request("POST", url, json.getString("origin"), "multipart/form-data; boundary=$boundary") { conn ->
            conn.setFixedLengthStreamingMode(head.size + file.length() + tail.size)
            conn.outputStream.use { out ->
                out.write(head)
                file.inputStream().use { it.copyTo(out, 64 * 1024) }
                out.write(tail)
            }
        }
    }

    // --- submit -----------------------------------------------------------------------------------

    /** True when this request is finished (done or given up); false = try again later. */
    private suspend fun submitIfReady(request: JSONObject): Boolean {
        val context = applicationContext
        val auctionId = request.getString("auctionId")
        val api = request.getString("apiOrigin")
        val origin = request.getString("origin")
        val mine = UploadStore.all(context).filter { it.auctionId == auctionId }
        if (mine.any { it.state == UploadStore.FAILED }) {
            UploadStore.dropSubmit(context, auctionId)
            notify(auctionId, "Eʼlon yuborilmadi", "Baʼzi fayllarni yuborib boʻlmadi. Ilovani ochib, ularni qayta yuboring.", "/sell/$auctionId?step=media")
            return true
        }
        if (mine.isNotEmpty()) return false

        // Videos are processed on the server; submitting before that would fail "media_count".
        repeat(36) {
            when (val state = request("GET", "$api/api/v1/auctions/$auctionId", origin, null, null)) {
                is Outcome.Ok -> {
                    val auction = state.body
                    val status = auction.optString("status")
                    if (status != "draft" && status != "rejected") {
                        UploadStore.dropSubmit(context, auctionId) // already submitted elsewhere
                        return true
                    }
                    val media = auction.optJSONArray("media")
                    val processing = (0 until (media?.length() ?: 0)).any {
                        media!!.getJSONObject(it).optString("status") == "processing"
                    }
                    if (!processing) return submit(auctionId, api, origin)
                }
                is Outcome.Final -> {
                    UploadStore.dropSubmit(context, auctionId)
                    notify(auctionId, "Eʼlon yuborilmadi", state.message, "/sell/$auctionId?step=review")
                    return true
                }
                Outcome.Retry -> return false
            }
            delay(5_000)
        }
        return false
    }

    private fun submit(auctionId: String, api: String, origin: String): Boolean {
        val context = applicationContext
        return when (val result = request("POST", "$api/api/v1/auctions/$auctionId/submit", origin, null, null)) {
            is Outcome.Ok -> {
                UploadStore.dropSubmit(context, auctionId)
                val outcome = result.body.optString("outcome")
                val reason = result.body.optJSONObject("auction")?.optJSONObject("owner")?.optString("rejection_reason").orEmpty()
                when (outcome) {
                    "published" -> notify(auctionId, "Auksion eʼlon qilindi", "Fayllar yuklandi va eʼloningiz chiqdi.", "/a/$auctionId")
                    "pending_review" -> notify(auctionId, "Auksion tekshiruvga yuborildi", "Moderator koʻrib chiqqach eʼlon qilinadi.", "/a/$auctionId")
                    else -> notify(auctionId, "Eʼlonda tuzatish kerak", reason.ifBlank { "Tekshiruvdan oʻtmadi. Ilovani ochib koʻring." }, "/sell/$auctionId?step=review")
                }
                UploadEvents.submitted(auctionId, outcome)
                true
            }
            is Outcome.Final -> {
                UploadStore.dropSubmit(context, auctionId)
                notify(auctionId, "Eʼlon yuborilmadi", result.message, "/sell/$auctionId?step=review")
                UploadEvents.submitted(auctionId, "error")
                true
            }
            Outcome.Retry -> false
        }
    }

    // --- http -------------------------------------------------------------------------------------

    private fun request(
        method: String,
        url: String,
        origin: String,
        contentType: String?,
        body: ((HttpURLConnection) -> Unit)?,
    ): Outcome {
        val conn = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (_: Exception) {
            return Outcome.Final("Notoʻgʻri manzil.")
        }
        return try {
            conn.requestMethod = method
            conn.connectTimeout = 20_000
            conn.readTimeout = 120_000
            conn.instanceFollowRedirects = false
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", "ZotdorApp/${BuildConfig.VERSION_NAME} (Android uploader)")
            CookieManager.getInstance().getCookie(url)?.let { conn.setRequestProperty("Cookie", it) }
            if (method != "GET") {
                conn.setRequestProperty("X-CSRFToken", UploadStore.csrf(applicationContext))
                conn.setRequestProperty("Origin", origin)
                conn.setRequestProperty("Referer", "$origin/")
            }
            if (contentType != null) conn.setRequestProperty("Content-Type", contentType)
            if (body != null) {
                conn.doOutput = true
                body(conn)
            } else if (method == "POST") {
                conn.doOutput = true
                conn.setFixedLengthStreamingMode(0)
                conn.outputStream.close()
            }
            val code = conn.responseCode
            val text = (if (code < 400) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            when {
                code in 200..299 -> Outcome.Ok(if (text.isBlank()) JSONObject() else JSONObject(text))
                code == 408 || code == 429 || code >= 500 -> Outcome.Retry
                code == 401 || code == 403 && text.contains("CSRF", ignoreCase = true) ->
                    Outcome.Final("Hisobga qayta kiring va faylni qayta yuboring.")
                else -> Outcome.Final(message(text))
            }
        } catch (_: IOException) {
            Outcome.Retry
        } catch (_: org.json.JSONException) {
            Outcome.Retry
        } finally {
            conn.disconnect()
        }
    }

    private fun message(text: String): String =
        try {
            JSONObject(text).optJSONObject("error")?.optString("message").orEmpty()
        } catch (_: Exception) {
            ""
        }.ifBlank { "Server faylni qabul qilmadi." }

    // --- notifications ----------------------------------------------------------------------------

    private fun foreground(count: Int): ForegroundInfo {
        val context = applicationContext
        val notification = NotificationCompat.Builder(context, Notifier.UPLOADS_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand))
            .setContentTitle("Fayllar yuborilmoqda")
            .setContentText(if (count > 0) "$count ta fayl qoldi" else "Eʼlon tayyorlanmoqda")
            .setOngoing(true)
            .setSilent(true)
            .setProgress(0, 0, true)
            .build()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(FOREGROUND_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(FOREGROUND_ID, notification)
        }
    }

    private fun notify(auctionId: String, title: String, body: String, url: String) {
        Notifier.show(
            applicationContext,
            mapOf("title" to title, "body" to body, "url" to url, "tag" to "submit-$auctionId", "channel" to "auctions"),
        )
    }

    private companion object {
        const val FOREGROUND_ID = 7301
    }
}
