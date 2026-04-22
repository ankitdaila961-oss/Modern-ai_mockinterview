# AI Mock Interview Platform

A full-stack web application for AI-powered mock interview practice.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: MySQL

## Folder Structure
```
ai interview web/
├── client/                 # Frontend
│   ├── css/style.css
│   ├── js/auth.js
│   ├── js/dashboard.js
│   ├── index.html          # Landing page
│   ├── register.html       # Register page
│   ├── login.html          # Login page
│   └── dashboard.html      # Dashboard page
├── server/                 # Backend
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── user.js
│   ├── db.js
│   └── index.js
├── .env                    # Environment variables
├── setup.sql               # Database setup script
└── package.json
```

## Getting Started

### 1. Setup the Database
Open MySQL and run:
```sql
source setup.sql
```

### 2. Configure Environment
Edit `.env` with your MySQL credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_interview_db
JWT_SECRET=your_secret_key
PORT=5000
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Server
```bash
npm start
```

Visit: **http://localhost:5000**

## Pages
| Page | URL |
|------|-----|
| Landing | `http://localhost:5000` |
| Register | `http://localhost:5000/register.html` |
| Login | `http://localhost:5000/login.html` |
| Dashboard | `http://localhost:5000/dashboard.html` |

## API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/user/profile` | Get profile (protected) |
