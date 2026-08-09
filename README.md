# Restaurant POS Starter

Single-shop POS starter with:
- Cashier POS
- Kitchen KDS
- Admin menu management
- Basic sales report
- FastAPI backend
- SQLite database for local/testing
- React + Vite frontend

## Local run
### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

Default admin PIN: `1234` (change before real use).

## Pages
- `/` Cashier POS
- `/kitchen` Kitchen KDS
- `/admin` Admin

## Important
This is a working starter/MVP, not yet a full Foodics replacement. Before production add authentication hardening, cloud PostgreSQL, backups, printer bridge, offline sync, audit logs, and payment gateway integration.
