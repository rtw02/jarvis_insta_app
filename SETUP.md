# JARVIS — Instagram Subject Analyzer

## Prerequisites
- Python 3.10+
- Node 18+

## Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
# runs on http://localhost:8000
```

## Frontend

```bash
cd frontend
npm install
npm run download-models   # downloads face-api.js model weights (~1MB)
npm run dev
# runs on http://localhost:3000
```

## Notes

- Only works on **public** Instagram accounts
- 2-year scan cap: 300 posts max (configurable in scraper.py)
- Instaloader may get rate-limited on large accounts (~500+ posts)
  → add a small delay in scraper.py between pages if needed
- First face-model load ~10s; subsequent runs instant (cached)
- Instagram CDN images are proxied through the backend to avoid CORS issues
