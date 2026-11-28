package uz.zotdor.web

import android.content.Context
import android.util.Base64
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/**
 * Photos and videos of the sell wizard waiting to be sent (frontend/src/features/sell/uploads.ts).
 * Each file lives in filesDir/uploads as <id>.bin with its description in <id>.json, so the
 * queue survives the app being closed; UploadWorker sends it. A seller's "Eʼlon qilish" while
 * files are still here is kept as submit-<auctionId>.json and done by the worker afterwards.
 */
object UploadStore {
    const val RECEIVING = "receiving"
    const val QUEUED = "queued"
    const val UPLOADING = "uploading"
    const val FAILED = "failed"

    private const val WORK = "zotdor-uploads"
    private const val MAX_BYTES = 300L * 1024 * 1024
    private const val STALE_RECEIVING_MS = 60 * 60_000L
    private val ID = Regex("^[A-Za-z0-9-]{8,64}$")
    private val KINDS = setOf("photo", "video")

    /** Newest CSRF token the site gave us; Django rotates it on login. */
    private const val PREFS = "uploads"
    private const val KEY_CSRF = "csrf"

    data class Item(val json: JSONObject) {
        val id: String get() = json.getString("id")
        val auctionId: String get() = json.getString("auctionId")
        val state: String get() = json.optString("state")
    }

    private fun dir(context: Context) = File(context.filesDir, "uploads").apply { mkdirs() }
    private fun meta(context: Context, id: String) = File(dir(context), "$id.json")
    fun data(context: Context, id: String) = File(dir(context), "$id.bin")
    private fun submitFile(context: Context, auctionId: String) = File(dir(context), "submit-$auctionId.json")

    fun csrf(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CSRF, "").orEmpty()

    private fun rememberCsrf(context: Context, token: String) {
        if (token.isNotBlank()) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_CSRF, token).apply()
        }
    }

    /** Only https (http in debug builds) and a plain origin: the worker sends cookies there. */
    private fun validOrigin(value: String): Boolean {
        val uri = android.net.Uri.parse(value)
        val schemeOk = uri.scheme == "https" || (BuildConfig.DEBUG && uri.scheme == "http")
        return schemeOk && !uri.host.isNullOrBlank() && uri.path.isNullOrEmpty()
    }

    @Synchronized
    fun begin(context: Context, header: JSONObject): Boolean {
        val id = header.optString("id")
        val auctionId = header.optString("auctionId")
        if (!ID.matches(id) || !ID.matches(auctionId) || header.optString("kind") !in KINDS) return false
        if (!validOrigin(header.optString("apiOrigin")) || !validOrigin(header.optString("origin"))) return false
        rememberCsrf(context, header.optString("csrf"))
        val item = JSONObject()
            .put("id", id)
            .put("auctionId", auctionId)
            .put("kind", header.getString("kind"))
            .put("fileName", header.optString("fileName").take(100).ifBlank { "file" })
            .put("mime", header.optString("mime").take(100))
            .put("sessionId", header.optString("sessionId").take(64))
            .put("meta", header.optString("meta").take(4000))
            .put("apiOrigin", header.getString("apiOrigin"))
            .put("origin", header.getString("origin"))
            .put("createdAt", header.optLong("createdAt", System.currentTimeMillis()))
            .put("receivedAt", System.currentTimeMillis())
            .put("state", RECEIVING)
            .put("error", "")
        return try {
            data(context, id).writeBytes(ByteArray(0))
            meta(context, id).writeText(item.toString())
            true
        } catch (_: Exception) {
            false
        }
    }

    @Synchronized
    fun append(context: Context, id: String, base64: String): Boolean {
        if (!ID.matches(id) || read(context, id)?.state != RECEIVING) return false
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val file = data(context, id)
            if (file.length() + bytes.size > MAX_BYTES) return false
            FileOutputStream(file, true).use { it.write(bytes) }
            true
        } catch (_: Exception) {
            false
        }
    }

    @Synchronized
    fun commit(context: Context, id: String): Boolean {
        val item = read(context, id) ?: return false
        if (item.state != RECEIVING) return false
        write(context, item.json.put("state", QUEUED))
        schedule(context)
        UploadEvents.changed(item.auctionId)
        return true
    }

    @Synchronized
    fun read(context: Context, id: String): Item? {
        if (!ID.matches(id)) return null
        return try {
            Item(JSONObject(meta(context, id).readText()))
        } catch (_: Exception) {
            null
        }
    }

    @Synchronized
    private fun write(context: Context, json: JSONObject) {
        meta(context, json.getString("id")).writeText(json.toString())
    }

    @Synchronized
    fun setState(context: Context, id: String, state: String, error: String = "") {
        val item = read(context, id) ?: return
        write(context, item.json.put("state", state).put("error", error))
    }

    @Synchronized
    fun all(context: Context): List<Item> {
        val now = System.currentTimeMillis()
        return dir(context).listFiles { f -> f.name.endsWith(".json") && !f.name.startsWith("submit-") }
            .orEmpty()
            .mapNotNull { f ->
                try {
                    Item(JSONObject(f.readText()))
                } catch (_: Exception) {
                    null
                }
            }
            .filter { item ->
                // A transfer the page never finished (closed mid-way) is dropped after an hour.
                val stale = item.state == RECEIVING && now - item.json.optLong("receivedAt") > STALE_RECEIVING_MS
                if (stale) remove(context, item.id)
                !stale
            }
            .sortedBy { it.json.optLong("createdAt") }
    }

    /** What the page shows: everything except a file still being handed over. */
    fun list(context: Context, auctionId: String): String {
        val out = JSONArray()
        all(context).filter { it.auctionId == auctionId && it.state != RECEIVING }.forEach { item ->
            out.put(
                JSONObject()
                    .put("id", item.id)
                    .put("auctionId", item.auctionId)
                    .put("kind", item.json.getString("kind"))
                    .put("state", item.state)
                    .put("error", item.json.optString("error"))
                    .put("createdAt", item.json.optLong("createdAt")),
            )
        }
        return out.toString()
    }

    fun next(context: Context): Item? = all(context).firstOrNull { it.state == QUEUED }

    @Synchronized
    fun retry(context: Context, id: String, csrf: String) {
        val item = read(context, id) ?: return
        rememberCsrf(context, csrf)
        write(context, item.json.put("state", QUEUED).put("error", ""))
        schedule(context)
        UploadEvents.changed(item.auctionId)
    }

    @Synchronized
    fun remove(context: Context, id: String) {
        if (!ID.matches(id)) return
        val auctionId = read(context, id)?.auctionId
        meta(context, id).delete()
        data(context, id).delete()
        if (auctionId != null) UploadEvents.changed(auctionId)
    }

    /** Requeue files left "uploading" by a worker that was killed. */
    @Synchronized
    fun resetInterrupted(context: Context) {
        all(context).filter { it.state == UPLOADING }.forEach { write(context, it.json.put("state", QUEUED)) }
    }

    // --- submit after upload ------------------------------------------------------------------

    @Synchronized
    fun requestSubmit(context: Context, request: JSONObject): Boolean {
        val auctionId = request.optString("auctionId")
        if (!ID.matches(auctionId)) return false
        if (!validOrigin(request.optString("apiOrigin")) || !validOrigin(request.optString("origin"))) return false
        rememberCsrf(context, request.optString("csrf"))
        submitFile(context, auctionId).writeText(
            JSONObject()
                .put("auctionId", auctionId)
                .put("apiOrigin", request.getString("apiOrigin"))
                .put("origin", request.getString("origin"))
                .put("requestedAt", System.currentTimeMillis())
                .toString(),
        )
        schedule(context)
        return true
    }

    fun hasSubmit(context: Context, auctionId: String): Boolean =
        ID.matches(auctionId) && submitFile(context, auctionId).exists()

    @Synchronized
    fun submits(context: Context): List<JSONObject> =
        dir(context).listFiles { f -> f.name.startsWith("submit-") && f.name.endsWith(".json") }
            .orEmpty()
            .mapNotNull {
                try {
                    JSONObject(it.readText())
                } catch (_: Exception) {
                    it.delete()
                    null
                }
            }

    @Synchronized
    fun dropSubmit(context: Context, auctionId: String) {
        if (ID.matches(auctionId)) submitFile(context, auctionId).delete()
    }

    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()
        // APPEND_OR_REPLACE: a file added while the worker is finishing still gets a run.
        WorkManager.getInstance(context).enqueueUniqueWork(WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }
}

/** Lets the open page hear about queue changes (MainActivity forwards them to WebBridge). */
object UploadEvents {
    @Volatile
    var listener: ((JSONObject) -> Unit)? = null

    fun changed(auctionId: String) {
        listener?.invoke(JSONObject().put("type", "uploads").put("auctionId", auctionId))
    }

    fun submitted(auctionId: String, outcome: String) {
        listener?.invoke(JSONObject().put("type", "submit-done").put("auctionId", auctionId).put("outcome", outcome))
    }
}
