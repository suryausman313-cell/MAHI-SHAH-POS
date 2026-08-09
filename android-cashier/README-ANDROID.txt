MAHI POS ANDROID CASHIER - DIRECT IP PRINT

What this app does:
- Opens the live MAHI POS inside one Android Cashier app.
- Exposes native Android TCP printing to the web POS.
- No Windows printer bridge is needed on Android.
- Admin > Printer: enter IP, port 9100, Auto Print ON, Save, Test Printer.
- SAVE ORDER can then print automatically.

Requirements:
- Android mobile/tablet and thermal printer on same Wi-Fi/LAN.
- Printer must support RAW TCP / ESC-POS, normally port 9100.
- If a printer uses a different protocol/SDK, its model-specific driver may be needed.

Build APK automatically:
1. Upload android-cashier/ and .github/workflows/build-cashier-apk.yml to GitHub.
2. GitHub > Actions > Build MAHI POS Cashier APK > Run workflow.
3. Download artifact "MAHI-POS-Cashier-APK".
4. Install app-debug.apk on the Cashier Android device.

If the live POS URL changes:
Edit:
android-cashier/app/src/main/java/com/mahipos/cashier/MainActivity.kt
and change POS_URL.
