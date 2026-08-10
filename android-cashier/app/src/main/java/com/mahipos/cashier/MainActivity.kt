package com.mahipos.cashier

import android.annotation.SuppressLint
import android.content.Context
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

        webView.webChromeClient =
            WebChromeClient()

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
         * Direct Android printer + drawer bridge.
         */

        webView.addJavascriptInterface(
            PrinterBridge(this),
            "AndroidPrinter"
        )

        /*
         * Open Cashier POS
         */

        webView.loadUrl(POS_URL)

        /*
         * Start central kitchen printer queue.
         *
         * iPad
         * iPhone
         * Waiter
         * Cashier
         *
         *      ↓
         *
         * Render Backend
         *
         *      ↓
         *
         * This Android Cashier device
         *
         *      ↓
         *
         * Kitchen Printer
         */

        mainHandler.post(queuePoller)
    }

    override fun onDestroy() {

        mainHandler.removeCallbacks(
            queuePoller
        )

        printExecutor.shutdownNow()

        super.onDestroy()
    }

    @Deprecated(
        "Deprecated in Java"
    )
    override fun onBackPressed() {

        if (webView.canGoBack()) {

            webView.goBack()

        } else {

            super.onBackPressed()
        }
    }

    /*
     * =====================================================
     * CENTRAL PRINT QUEUE
     * =====================================================
     */

    private fun pollPrintQueue() {

        if (queueBusy) {
            return
        }

        queueBusy = true

        printExecutor.execute {

            try {

                val response =
                    httpJson(
                        "$BACKEND_URL/print-queue/next",
                        "GET",
                        null
                    )

                val job =
                    response.optJSONObject(
                        "job"
                    )

                if (job != null) {

                    processPrintJob(job)
                }

            } catch (_: Exception) {

                /*
                 * Backend may temporarily be
                 * sleeping/restarting.
                 *
                 * Next poll retries automatically.
                 */
            } finally {

                queueBusy = false
            }
        }
    }

    private fun processPrintJob(
        job: JSONObject
    ) {

        val jobId =
            job.optInt(
                "id",
                0
            )

        if (jobId <= 0) {
            return
        }

        try {

            val ip =
                job
                    .optString("ip")
                    .trim()

            val port =
                job.optInt(
                    "port",
                    9100
                )

            val cut =
                job.optBoolean(
                    "cut",
                    true
                )

            val lines =
                job.optJSONArray(
                    "lines"
                ) ?: JSONArray()

            if (ip.isBlank()) {

                throw Exception(
                    "Printer IP missing in print job"
                )
            }

            val bytes =
                buildEscPos(
                    lines,
                    cut
                )

            sendRaw(
                ip,
                port,
                bytes
            )

            /*
             * Tell backend:
             * print completed.
             */

            httpJson(
                "$BACKEND_URL/print-queue/$jobId/done",
                "POST",
                "{}"
            )

        } catch (e: Exception) {

            val error =
                e.message
                    ?: e.javaClass.simpleName

            /*
             * Tell backend:
             * print failed.
             */

            try {

                val body =
                    JSONObject()
                        .put(
                            "error",
                            error
                        )
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

    /*
     * =====================================================
     * BACKEND HTTP
     * =====================================================
     */

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

            connection.requestMethod =
                method

            connection.connectTimeout =
                10000

            connection.readTimeout =
                10000

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
                if (
                    code in 200..299
                ) {

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

            if (
                code !in 200..299
            ) {

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

            return if (
                text.isBlank()
            ) {

                JSONObject()

            } else {

                JSONObject(text)
            }

        } finally {

            connection.disconnect()
        }
    }

    /*
     * =====================================================
     * JAVASCRIPT → ANDROID
     * =====================================================
     */

    inner class PrinterBridge(
        private val context: Context
    ) {

        /*
         * DIRECT RECEIPT PRINT
         */

        @JavascriptInterface
        fun printReceipt(
            jsonPayload: String
        ): String {

            return try {

                val data =
                    JSONObject(
                        jsonPayload
                    )

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
                    data.optJSONArray(
                        "lines"
                    ) ?: JSONArray()

                if (ip.isBlank()) {

                    return JSONObject()
                        .put(
                            "ok",
                            false
                        )
                        .put(
                            "error",
                            "Printer IP is empty"
                        )
                        .toString()
                }

                val bytes =
                    buildEscPos(
                        lines,
                        cut
                    )

                sendRaw(
                    ip,
                    port,
                    bytes
                )

                JSONObject()
                    .put(
                        "ok",
                        true
                    )
                    .put(
                        "ip",
                        ip
                    )
                    .put(
                        "port",
                        port
                    )
                    .toString()

            } catch (e: Exception) {

                JSONObject()
                    .put(
                        "ok",
                        false
                    )
                    .put(
                        "error",
                        e.message
                            ?: e.javaClass.simpleName
                    )
                    .toString()
            }
        }

        /*
         * CASH DRAWER OPEN
         */

        @JavascriptInterface
        fun openDrawer(
            jsonPayload: String
        ): String {

            return try {

                val data =
                    JSONObject(
                        jsonPayload
                    )

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
                        .put(
                            "ok",
                            false
                        )
                        .put(
                            "error",
                            "Printer IP is empty"
                        )
                        .toString()
                }

                /*
                 * ESC/POS Drawer Pulse
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
                    .put(
                        "ok",
                        true
                    )
                    .toString()

            } catch (e: Exception) {

                JSONObject()
                    .put(
                        "ok",
                        false
                    )
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
     * =====================================================
     * ESC/POS RECEIPT
     * =====================================================
     */

    private fun buildEscPos(
        lines: JSONArray,
        cut: Boolean
    ): ByteArray {

        val out =
            ArrayList<Byte>()

        fun add(
            vararg bytes: Int
        ) {

            bytes.forEach {

                out.add(
                    it.toByte()
                )
            }
        }

        fun addText(
            text: String
        ) {

            text
                .toByteArray(
                    Charset.forName(
                        "UTF-8"
                    )
                )
                .forEach {

                    out.add(it)
                }
        }

        /*
         * Printer initialize
         */

        add(
            0x1B,
            0x40
        )

        for (
            i in
            0 until lines.length()
        ) {

            val line =
                lines.optString(
                    i,
                    ""
                )

            /*
             * First line:
             * centered + bold + large
             */

            if (i == 0) {

                add(
                    0x1B,
                    0x61,
                    0x01
                )

                add(
                    0x1B,
                    0x45,
                    0x01
                )

                add(
                    0x1D,
                    0x21,
                    0x11
                )

                addText(line)

                addText("\n")

                /*
                 * Reset text size
                 */

                add(
                    0x1D,
                    0x21,
                    0x00
                )

                /*
                 * Bold OFF
                 */

                add(
                    0x1B,
                    0x45,
                    0x00
                )

                /*
                 * Left align
                 */

                add(
                    0x1B,
                    0x61,
                    0x00
                )

            } else {

                addText(line)

                addText("\n")
            }
        }

        /*
         * Feed paper
         */

        addText(
            "\n\n\n"
        )

        /*
         * Auto cut
         */

        if (cut) {

            add(
                0x1D,
                0x56,
                0x00
            )
        }

        return out.toByteArray()
    }

    /*
     * =====================================================
     * RAW LAN PRINTER CONNECTION
     * =====================================================
     */

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
                    socket.getOutputStream()
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
