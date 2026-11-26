package uz.zotdor.web

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/**
 * The whole app: web.zotdor.uz in a WebView, with native parts around it (docs/ANDROID.md):
 * splash, offline screen (also on the very first launch), runtime permissions handed to the
 * page (location, camera, notifications), external links in their own apps, back navigation,
 * pull to refresh and pages opened from notifications or web.zotdor.uz links.
 */
class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_URL = "uz.zotdor.web.URL"
    }

    private val baseUri: Uri = Uri.parse(BuildConfig.BASE_URL)
    val appHost: String = baseUri.host.orEmpty()

    private lateinit var web: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var offline: View
    private lateinit var bridge: WebBridge

    private var ready = false
    private var failedUrl: String? = null
    private var geoRequest: Pair<String, GeolocationPermissions.Callback>? = null
    private var mediaRequest: PermissionRequest? = null

    private val locationPermission =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val granted = result.values.any { it }
            geoRequest?.let { (origin, callback) -> callback.invoke(origin, granted, false) }
            geoRequest = null
            if (!granted) toast(R.string.location_denied)
        }

    private val cameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            mediaRequest?.let { if (granted) it.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else it.deny() }
            mediaRequest = null
            if (!granted) toast(R.string.camera_denied)
        }

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            bridge.emitPermission()
            PushStore.refresh(this)
        }

    private val connectivity by lazy { getSystemService(ConnectivityManager::class.java) }
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread { if (offline.isVisible) retry() }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        // Keep the splash until the first page is drawn (or the offline screen is), at most 4 s.
        splash.setKeepOnScreenCondition { !ready }
        window.decorView.postDelayed({ ready = true }, 4000)

        setContentView(R.layout.activity_main)
        setUpSystemBars()
        web = findViewById(R.id.web)
        swipe = findViewById(R.id.swipe)
        progress = findViewById(R.id.progress)
        offline = findViewById(R.id.offline)
        findViewById<Button>(R.id.retry).setOnClickListener { retry() }

        setUpWebView()
        swipe.setColorSchemeResources(R.color.brand)
        swipe.setOnRefreshListener { if (offline.isVisible) retry() else web.reload() }
        // Pull to refresh only at the very top of the page.
        swipe.setOnChildScrollUpCallback { _, _ -> web.scrollY > 0 }

        onBackPressedDispatcher.addCallback(this) {
            if (!offline.isVisible && web.canGoBack()) web.goBack() else finish()
        }

        PushStore.listener = { token -> bridge.emitPushToken(token) }

        if (savedInstanceState != null && web.restoreState(savedInstanceState) != null) {
            ready = true
        } else {
            load(startUrl(intent))
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.hasExtra(EXTRA_URL) || intent.data != null) load(startUrl(intent))
    }

    override fun onStart() {
        super.onStart()
        connectivity.registerDefaultNetworkCallback(networkCallback)
    }

    override fun onStop() {
        connectivity.unregisterNetworkCallback(networkCallback)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        // The user may have changed notification settings meanwhile.
        bridge.emitPermission()
    }

    override fun onPause() {
        web.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        PushStore.listener = null
        web.destroy()
        super.onDestroy()
    }

    // --- set-up ----------------------------------------------------------------------------------

    /** Edge-to-edge: content padded by the system bars; the ink root shows behind them. */
    private fun setUpSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        val content = findViewById<View>(R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // muted gallery videos autoplay, like on the site
            setGeolocationEnabled(true)
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // The site recognises the app (native.ts) and never registers its service worker here.
            userAgentString = "$userAgentString ZotdorApp/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, true) // the API is api.zotdor.uz
        }
        bridge = WebBridge(this, web)
        web.addJavascriptInterface(bridge, "ZotdorAndroid")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (isOwn(uri)) return false
                openExternal(uri)
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                bridge.pageHost = Uri.parse(url).host
                progress.isVisible = true
            }

            override fun onPageFinished(view: WebView, url: String) {
                progress.isVisible = false
                swipe.isRefreshing = false
                if (!offline.isVisible) ready = true
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    failedUrl = request.url.toString()
                    showOffline()
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                progress.isVisible = newProgress < 100
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (!isOwn(Uri.parse(origin))) {
                    callback.invoke(origin, false, false)
                    return
                }
                if (granted(Manifest.permission.ACCESS_FINE_LOCATION) || granted(Manifest.permission.ACCESS_COARSE_LOCATION)) {
                    callback.invoke(origin, true, false)
                } else {
                    geoRequest = origin to callback
                    locationPermission.launch(
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                    )
                }
            }

            override fun onGeolocationPermissionsHidePrompt() {
                geoRequest = null
            }

            /** getUserMedia: only the camera, only for our site (the sell wizard, BR-12). */
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val wantsCamera = PermissionRequest.RESOURCE_VIDEO_CAPTURE in request.resources
                    if (!isOwn(request.origin) || !wantsCamera) {
                        request.deny()
                    } else if (granted(Manifest.permission.CAMERA)) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    } else {
                        mediaRequest = request
                        cameraPermission.launch(Manifest.permission.CAMERA)
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (mediaRequest == request) mediaRequest = null
            }
        }
    }

    // --- navigation --------------------------------------------------------------------------------

    private fun isOwn(uri: Uri): Boolean =
        uri.host == appHost && (uri.scheme == "https" || (BuildConfig.DEBUG && uri.scheme == "http"))

    /** A notification's path, a web.zotdor.uz link that opened the app, or the home page. */
    private fun startUrl(intent: Intent?): String {
        intent?.getStringExtra(EXTRA_URL)?.let { return resolve(it) }
        intent?.data?.let { if (isOwn(it)) return it.toString() }
        return BuildConfig.BASE_URL
    }

    private fun resolve(pathOrUrl: String): String {
        if (pathOrUrl.startsWith("/")) return BuildConfig.BASE_URL.trimEnd('/') + pathOrUrl
        val uri = Uri.parse(pathOrUrl)
        return if (isOwn(uri)) pathOrUrl else BuildConfig.BASE_URL
    }

    private fun load(url: String) {
        if (!isOnline()) {
            failedUrl = url
            showOffline()
            return
        }
        hideOffline()
        web.loadUrl(url)
    }

    private fun retry() {
        val url = failedUrl ?: web.url ?: BuildConfig.BASE_URL
        failedUrl = null
        load(url)
    }

    private fun showOffline() {
        offline.isVisible = true
        swipe.isVisible = false
        progress.isVisible = false
        swipe.isRefreshing = false
        ready = true
    }

    private fun hideOffline() {
        offline.isVisible = false
        swipe.isVisible = true
    }

    private fun isOnline(): Boolean {
        val caps = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** tel:, Telegram, maps, other sites: in the app that handles them, not inside ours. */
    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) {
            toast(R.string.no_app_for_link)
        }
    }

    // --- notifications (called through WebBridge) -------------------------------------------------

    fun requestNotificationPermission() {
        val state = Notifier.permission(this)
        when {
            state == "granted" -> bridge.emitPermission()
            Build.VERSION.SDK_INT >= 33 && state == "default" -> {
                Notifier.markAsked(this)
                notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            else -> openNotificationSettings()
        }
    }

    fun openNotificationSettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
        }
        startActivity(intent)
    }

    // --- helpers -----------------------------------------------------------------------------------

    private fun granted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun toast(message: Int) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}
