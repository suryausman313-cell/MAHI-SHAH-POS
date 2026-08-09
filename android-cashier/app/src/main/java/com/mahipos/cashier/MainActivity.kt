package com.mahipos.cashier

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.net.ConnectivityManager
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.Charset

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        // Change only if your Cloudflare URL changes.
        private const val POS_URL = "https://mahi-shah-pos.suryausman313.workers.dev/"
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
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
        }

        webView.addJavascriptInterface(PrinterBridge(this), "AndroidPrinter")
        webView.loadUrl(POS_URL)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    inner class PrinterBridge(private val context: Context) {

        @JavascriptInterface
        fun printReceipt(jsonPayload: String): String {
            return try {
                val data = JSONObject(jsonPayload)
                val ip = data.optString("ip").trim()
                val port = data.optInt("port", 9100)
                val cut = data.optBoolean("cut", true)
                val lines = data.optJSONArray("lines") ?: JSONArray()

                if (ip.isBlank()) {
                    return JSONObject()
                        .put("ok", false)
                        .put("error", "Printer IP is empty")
                        .toString()
                }

                val bytes = buildEscPos(lines, cut)
                sendRaw(ip, port, bytes)

                JSONObject()
                    .put("ok", true)
                    .put("ip", ip)
                    .put("port", port)
                    .toString()

            } catch (e: Exception) {
                JSONObject()
                    .put("ok", false)
                    .put("error", e.message ?: e.javaClass.simpleName)
                    .toString()
            }
        }


        @JavascriptInterface
        fun openDrawer(jsonPayload: String): String {
            return try {
                val data = JSONObject(jsonPayload)
                val ip = data.optString("ip").trim()
                val port = data.optInt("port", 9100)

                if (ip.isBlank()) {
                    return JSONObject()
                        .put("ok", false)
                        .put("error", "Printer IP is empty")
                        .toString()
                }

                // ESC/POS cash drawer pulse: ESC p m t1 t2
                val pulse = byteArrayOf(
                    0x1B.toByte(), 0x70.toByte(), 0x00.toByte(),
                    0x19.toByte(), 0xFA.toByte()
                )
                sendRaw(ip, port, pulse)

                JSONObject()
                    .put("ok", true)
                    .put("ip", ip)
                    .put("port", port)
                    .toString()
            } catch (e: Exception) {
                JSONObject()
                    .put("ok", false)
                    .put("error", e.message ?: e.javaClass.simpleName)
                    .toString()
            }
        }

        private fun buildEscPos(lines: JSONArray, cut: Boolean): ByteArray {
            val out = ArrayList<Byte>()
            fun add(vararg b: Int) { b.forEach { out.add(it.toByte()) } }
            fun addText(text: String) {
                text.toByteArray(Charset.forName("UTF-8")).forEach { out.add(it) }
            }

            // Initialize printer
            add(0x1B, 0x40)

            for (i in 0 until lines.length()) {
                val line = lines.optString(i, "")
                if (i == 0) {
                    // Center + bold + double height/width for shop name
                    add(0x1B, 0x61, 0x01)
                    add(0x1B, 0x45, 0x01)
                    add(0x1D, 0x21, 0x11)
                    addText(line)
                    addText("\n")
                    add(0x1D, 0x21, 0x00)
                    add(0x1B, 0x45, 0x00)
                    add(0x1B, 0x61, 0x00)
                } else {
                    addText(line)
                    addText("\n")
                }
            }

            addText("\n\n\n")
            if (cut) {
                // Full cut
                add(0x1D, 0x56, 0x00)
            }

            return out.toByteArray()
        }

        private fun sendRaw(ip: String, port: Int, data: ByteArray) {
            val socket = Socket()
            try {
                socket.connect(InetSocketAddress(ip, port), 5000)
                socket.soTimeout = 5000
                val output = BufferedOutputStream(socket.getOutputStream())
                output.write(data)
                output.flush()
                output.close()
            } finally {
                try { socket.close() } catch (_: Exception) {}
            }
        }
    }
}
