# Restaurant POS Full Starter
Includes Cashier, Waiter, Kitchen KDS, Tables, Admin, Menu, Staff/PIN base, Inventory base, Expenses API, Reports, Receipt printing, Printer settings and PWA manifest.

Run backend:
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

Run frontend:
cd frontend
npm install
npm run dev

Important: direct silent printing to a LAN thermal printer by IP requires an installed Android/Windows wrapper or local print bridge. Normal browser/PWA printing can print receipts now.
