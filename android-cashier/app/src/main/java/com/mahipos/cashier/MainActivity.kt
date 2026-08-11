package com.mahipos.cashier

import android.annotation.SuppressLint
import android.content.Context
import android.util.Base64
import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.nio.charset.Charset
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val mainHandler = Handler(Looper.getMainLooper())
    private val printExecutor = Executors.newSingleThreadExecutor()

    @Volatile
    private var queueBusy = false

    companion object {
        private const val POS_URL =
            "https://mahi-shah-pos.suryausman313.workers.dev/"

        private const val BACKEND_URL =
            "https://mahi-shah-pos-api.onrender.com"

        private const val POLL_INTERVAL_MS = 2000L
    }

    private val queuePoller = object : Runnable {
        override fun run() {
            pollPrintQueue()
            mainHandler.postDelayed(
                this,
                POLL_INTERVAL_MS
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.setSupportZoom(false)

        webView.webChromeClient = WebChromeClient()

        webView.webViewClient =
            object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    return false
                }
            }

        /*
         * Native bridge used by the Cashier web app for:
         * - manual printer test/direct receipt
         * - cash drawer pulse
         */
        webView.addJavascriptInterface(
            PrinterBridge(this),
            "AndroidPrinter"
        )

        webView.loadUrl(POS_URL)

        /*
         * Cashier Android device is now the permanent
         * central kitchen print bridge.
         *
         * Android / iPad / iPhone / Waiter
         *      -> Backend Print Queue
         *      -> THIS Cashier Android device
         *      -> Kitchen printer
         */
        mainHandler.post(queuePoller)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(queuePoller)
        printExecutor.shutdownNow()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    /*
     * ============================================================
     * CENTRAL BACKEND PRINT QUEUE
     * ============================================================
     */

    private fun pollPrintQueue() {
        if (queueBusy) {
            return
        }

        queueBusy = true

        printExecutor.execute {
            try {
                val response = httpJson(
                    "$BACKEND_URL/print-queue/next",
                    "GET",
                    null
                )

                val job = response.optJSONObject("job")

                if (job != null) {
                    processPrintJob(job)
                }

            } catch (_: Exception) {
                /*
                 * Backend may briefly sleep/restart.
                 * Next poll will retry automatically.
                 */
            } finally {
                queueBusy = false
            }
        }
    }

    private fun processPrintJob(job: JSONObject) {
        val jobId = job.optInt("id", 0)

        if (jobId <= 0) {
            return
        }

        try {
            val ip = job.optString("ip").trim()
            val port = job.optInt("port", 9100)
            val cut = job.optBoolean("cut", true)
            val lines =
                job.optJSONArray("lines")
                    ?: JSONArray()

            val logoDataUrl =
                job.optString("logo_data_url", "")

            val receiptStyle =
                job.optString("receipt_style", "professional")

            if (ip.isBlank()) {
                throw Exception(
                    "Printer IP missing in print job"
                )
            }

            val bytes =
                buildEscPos(
                    lines,
                    cut,
                    logoDataUrl,
                    receiptStyle
                )

            sendRaw(
                ip,
                port,
                bytes
            )

            httpJson(
                "$BACKEND_URL/print-queue/$jobId/done",
                "POST",
                "{}"
            )

        } catch (e: Exception) {

            val error =
                e.message
                    ?: e.javaClass.simpleName

            try {
                val body =
                    JSONObject()
                        .put("error", error)
                        .toString()

                httpJson(
                    "$BACKEND_URL/print-queue/$jobId/fail",
                    "POST",
                    body
                )

            } catch (_: Exception) {
            }
        }
    }

    private fun httpJson(
        urlText: String,
        method: String,
        body: String?
    ): JSONObject {

        val connection =
            URL(urlText)
                .openConnection()
                    as HttpURLConnection

        try {
            connection.requestMethod = method
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.setRequestProperty(
                "Accept",
                "application/json"
            )

            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty(
                    "Content-Type",
                    "application/json"
                )

                connection.outputStream.use {
                    it.write(
                        body.toByteArray(
                            Charsets.UTF_8
                        )
                    )
                }
            }

            val code =
                connection.responseCode

            val stream =
                if (code in 200..299) {
                    connection.inputStream
                } else {
                    connection.errorStream
                }

            val text =
                if (stream != null) {
                    BufferedReader(
                        InputStreamReader(
                            stream,
                            Charsets.UTF_8
                        )
                    ).use {
                        it.readText()
                    }
                } else {
                    ""
                }

            if (code !in 200..299) {
                var message =
                    "HTTP $code"

                try {
                    val json =
                        JSONObject(text)

                    message =
                        json.optString(
                            "detail",
                            message
                        )
                } catch (_: Exception) {
                }

                throw Exception(message)
            }

            return if (text.isBlank()) {
                JSONObject()
            } else {
                JSONObject(text)
            }

        } finally {
            connection.disconnect()
        }
    }

    /*
     * ============================================================
     * JAVASCRIPT -> ANDROID NATIVE PRINTER / DRAWER
     * ============================================================
     */

    inner class PrinterBridge(
        private val context: Context
    ) {

        @JavascriptInterface
        fun printReceipt(
            jsonPayload: String
        ): String {

            return try {
                val data =
                    JSONObject(jsonPayload)

                val ip =
                    data
                        .optString("ip")
                        .trim()

                val port =
                    data.optInt(
                        "port",
                        9100
                    )

                val cut =
                    data.optBoolean(
                        "cut",
                        true
                    )

                val lines =
                    data.optJSONArray("lines")
                        ?: JSONArray()

                val logoDataUrl =
                    data.optString("logo_data_url", "")

                val receiptStyle =
                    data.optString("receipt_style", "professional")

                if (ip.isBlank()) {
                    return JSONObject()
                        .put("ok", false)
                        .put(
                            "error",
                            "Printer IP is empty"
                        )
                        .toString()
                }

                val bytes =
                    buildEscPos(
                        lines,
                        cut,
                        logoDataUrl,
                        receiptStyle
                    )

                sendRaw(
                    ip,
                    port,
                    bytes
                )

                JSONObject()
                    .put("ok", true)
                    .put("ip", ip)
                    .put("port", port)
                    .toString()

            } catch (e: Exception) {

                JSONObject()
                    .put("ok", false)
                    .put(
                        "error",
                        e.message
                            ?: e.javaClass.simpleName
                    )
                    .toString()
            }
        }

        /*
         * Standard ESC/POS cash drawer pulse.
         * Drawer must be connected to the thermal printer.
         */
        @JavascriptInterface
        fun openDrawer(
            jsonPayload: String
        ): String {

            return try {
                val data =
                    JSONObject(jsonPayload)

                val ip =
                    data
                        .optString("ip")
                        .trim()

                val port =
                    data.optInt(
                        "port",
                        9100
                    )

                if (ip.isBlank()) {
                    return JSONObject()
                        .put("ok", false)
                        .put(
                            "error",
                            "Printer IP is empty"
                        )
                        .toString()
                }

                /*
                 * ESC p m t1 t2
                 * Pulse drawer pin 2.
                 */
                val pulse =
                    byteArrayOf(
                        0x1B.toByte(),
                        0x70.toByte(),
                        0x00.toByte(),
                        0x19.toByte(),
                        0xFA.toByte()
                    )

                sendRaw(
                    ip,
                    port,
                    pulse
                )

                JSONObject()
                    .put("ok", true)
                    .toString()

            } catch (e: Exception) {

                JSONObject()
                    .put("ok", false)
                    .put(
                        "error",
                        e.message
                            ?: e.javaClass.simpleName
                    )
                    .toString()
            }
        }
    }

    /*
     * ============================================================
     * ESC/POS
     * ============================================================
     */

    private fun buildEscPos(
        lines: JSONArray,
        cut: Boolean,
        logoDataUrl: String = "",
        receiptStyle: String = "professional"
    ): ByteArray {

        val out = ArrayList<Byte>()

        fun add(vararg bytes: Int) {
            bytes.forEach { out.add(it.toByte()) }
        }

        fun addBytes(bytes: ByteArray) {
            bytes.forEach { out.add(it) }
        }

        fun text(value: String) {
            value.toByteArray(Charset.forName("UTF-8")).forEach { out.add(it) }
        }

        fun nl(count: Int = 1) {
            repeat(count) { text("\n") }
        }

        fun align(value: Int) {
            add(0x1B, 0x61, value)
        }

        fun bold(on: Boolean) {
            add(0x1B, 0x45, if (on) 0x01 else 0x00)
        }

        fun size(width: Int, height: Int) {
            val w = (width.coerceIn(1, 8) - 1) shl 4
            val h = height.coerceIn(1, 8) - 1
            add(0x1D, 0x21, w or h)
        }

        fun resetText() {
            align(0)
            bold(false)
            size(1, 1)
        }

        add(0x1B, 0x40)

        if (logoDataUrl.isNotBlank()) {
            try {
                val bitmap = decodeLogoBitmap(logoDataUrl)
                if (bitmap != null) {
                    align(1)
                    addBytes(bitmapToEscPos(bitmap))
                    nl()
                    align(0)
                }
            } catch (_: Exception) {
            }
        }

        if (receiptStyle == "kitchen") {
            for (i in 0 until lines.length()) {
                val raw = lines.optString(i, "")

                when {
                    raw.startsWith("@SHOP|") -> {
                        align(1); bold(true); size(2,2)
                        text(raw.substringAfter("|")); nl()
                        resetText()
                    }
                    raw.startsWith("@TITLE|") -> {
                        align(1); bold(true); size(2,2)
                        text(raw.substringAfter("|")); nl()
                        resetText()
                        text("------------------------------------------"); nl()
                    }
                    raw.startsWith("@ORDER|") -> {
                        align(0); bold(true); size(2,2)
                        text(raw.substringAfter("|")); nl()
                        resetText()
                    }
                    raw.startsWith("@META|") -> {
                        bold(true)
                        text(raw.substringAfter("|")); nl()
                        resetText()
                    }
                    raw.startsWith("@SEP|") -> {
                        resetText()
                        text("=========================================="); nl()
                    }
                    raw.startsWith("@ITEM|") -> {
                        align(0); bold(true); size(2,2)
                        text(raw.substringAfter("|")); nl()
                        resetText()
                    }
                    raw.startsWith("@SIZE|") -> {
                        bold(true)
                        text("   " + raw.substringAfter("|")); nl()
                        resetText()
                    }
                    raw.startsWith("@MOD|") -> {
                        text("   " + raw.substringAfter("|")); nl()
                    }
                    raw.startsWith("@NOTE|") -> {
                        bold(true); size(1,2)
                        text("   " + raw.substringAfter("|")); nl()
                        resetText()
                    }
                    raw.startsWith("@ITEMSEP|") -> {
                        resetText()
                        text("------------------------------------------"); nl()
                    }
                    raw.startsWith("@FOOT|") -> {
                        align(1); bold(true)
                        text(raw.substringAfter("|")); nl()
                        resetText()
                    }
                    else -> {
                        resetText()
                        text(raw); nl()
                    }
                }
            }
        } else {
            for (i in 0 until lines.length()) {
                val line = lines.optString(i, "")
                if (i == 0) {
                    align(1); bold(true); size(2,2)
                    text(line); nl()
                    resetText()
                } else {
                    text(line); nl()
                }
            }
        }

        nl(4)

        if (cut) {
            add(0x1D, 0x56, 0x00)
        }

        return out.toByteArray()
    }

    private fun decodeLogoBitmap(
        dataUrl: String
    ): Bitmap? {
        val base64 =
            if (dataUrl.contains(",")) {
                dataUrl.substringAfter(",")
            } else {
                dataUrl
            }

        val bytes =
            Base64.decode(
                base64,
                Base64.DEFAULT
            )

        return BitmapFactory.decodeByteArray(
            bytes,
            0,
            bytes.size
        )
    }

    private fun bitmapToEscPos(
        source: Bitmap
    ): ByteArray {
        val maxWidth = 384

        val bitmap =
            if (source.width > maxWidth) {
                val ratio =
                    maxWidth.toFloat() /
                    source.width.toFloat()

                Bitmap.createScaledBitmap(
                    source,
                    maxWidth,
                    (source.height * ratio)
                        .toInt()
                        .coerceAtLeast(1),
                    true
                )
            } else {
                source
            }

        val width = bitmap.width
        val height = bitmap.height
        val widthBytes = (width + 7) / 8

        val data =
            ByteArray(
                widthBytes * height
            )

        var index = 0

        for (y in 0 until height) {
            for (xb in 0 until widthBytes) {
                var value = 0

                for (bit in 0 until 8) {
                    val x = xb * 8 + bit

                    if (x < width) {
                        val pixel =
                            bitmap.getPixel(
                                x,
                                y
                            )

                        val r =
                            (pixel shr 16) and 0xff
                        val g =
                            (pixel shr 8) and 0xff
                        val b =
                            pixel and 0xff

                        val gray =
                            (r * 0.299 +
                             g * 0.587 +
                             b * 0.114)

                        if (gray < 160) {
                            value =
                                value or
                                (0x80 shr bit)
                        }
                    }
                }

                data[index++] =
                    value.toByte()
            }
        }

        val header =
            byteArrayOf(
                0x1D,
                0x76,
                0x30,
                0x00,
                (widthBytes and 0xff).toByte(),
                ((widthBytes shr 8) and 0xff).toByte(),
                (height and 0xff).toByte(),
                ((height shr 8) and 0xff).toByte()
            )

        return header + data
    }

    private fun sendRaw(
        ip: String,
        port: Int,
        data: ByteArray
    ) {

        val socket =
            Socket()

        try {
            socket.connect(
                InetSocketAddress(
                    ip,
                    port
                ),
                7000
            )

            socket.soTimeout =
                7000

            val output =
                BufferedOutputStream(
                    socket
                        .getOutputStream()
                )

            output.write(data)
            output.flush()
            output.close()

        } finally {

            try {
                socket.close()
            } catch (_: Exception) {
            }
        }
    }
}
