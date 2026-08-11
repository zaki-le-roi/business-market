# Business Market — Enterprise E-Commerce & B2B Management System

Business Market is an enterprise-grade multi-channel E-Commerce and Wholesale B2B management platform built specifically for the Algerian market (58 Wilayas). It features native integrations for Algerian carrier logistics (Yalidine, Maystro, ZR Express), double-entry finance, inventory warehouse management, B2B price lists, automated OTA mobile app updates, and multi-language support (Arabic, French, English) with full RTL/LTR capabilities.

---

## 🏗️ Architecture Overview

- **Frontend Application**: React 18 + Vite + Tailwind CSS + Lucide React + Motion.
- **Backend Service**: Express.js server on Node.js (bundled with `esbuild` for production).
- **Database & Auth**: Supabase PostgreSQL database with Row-Level Security (RLS) policies.
- **Media Storage**: Supabase Storage Buckets (`product-images`, `categories`, `cms-images`, `homepage-banners`, `system-assets`).
- **Mobile App**: Capacitor 8 for Android runtime with OTA automatic update updates.
- **Shipping Logistics Engine**: Express API routing with server-side carrier key encapsulation.

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v20+ or v22 LTS)
- npm or yarn
- Android Studio & JDK 17 (for Android mobile APK compilation)

### Steps
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/zaki-le-roi/business-market.git
   cd business-market
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in required project values:
   ```bash
   cp .env.example .env
   ```

---

## 🔐 Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Public (Client/Server) | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public (Client) | Supabase Publishable / Anon Key |
| `GITHUB_TOKEN` | Private (Server/CI) | Token for OTA release management |
| `YALIDINE_API_KEY` | Private (Server) | Yalidine Logistics API Key |
| `YALIDINE_API_TOKEN` | Private (Server) | Yalidine Logistics API Token |
| `MAYSTRO_API_KEY` | Private (Server) | Maystro Delivery API Secret |
| `ZR_EXPRESS_API_KEY` | Private (Server) | ZR Express Shipping Key |

---

## 🗄️ Supabase Setup & Database Migrations

All SQL schema definitions, RLS policies, triggers, and seed data are maintained in `supabase/migrations/`:

```bash
# Apply pending migrations to Supabase
npx supabase db push
```

### Key Relational Tables:
- `products`, `categories`, `orders`, `customers`, `coupons`
- `warehouses`, `inventory_levels`, `stock_movements`, `stock_transfers`
- `invoices`, `financial_accounts`, `payments`, `expenses`
- `wilayas`, `system_settings`, `homepage_banners`, `cms_content`

---

## 💾 Database Backup & Disaster Recovery Strategy

1. **Automated Daily Backups**:
   Supabase automatically takes daily physical point-in-time recovery (PITR) backups for the production instance (`dyhpfgjogdiongmcmoti.supabase.co`).

2. **Logical Dump Export**:
   Run logical backups using the Supabase CLI:
   ```bash
   npx supabase db dump -f backup_$(date +%Y%m%d).sql
   ```

---

## 🚀 Development & Production Build

### Running Locally
```bash
# Start development server on http://localhost:3000
npm run dev
```

### Production Compilation
```bash
# Build React web application & bundle Express server
npm run build

# Start production server
npm start
```

---

## 📱 Capacitor & Android Build

```bash
# Build web assets and sync with Capacitor Android project
npm run cap:sync

# Open Android project in Android Studio
npm run cap:open
```

Android APK release packages are automatically compiled via GitHub Actions CI/CD (`.github/workflows/build-and-release-apk.yml`).

---

## 🔒 Security & RBAC

- **Authentication**: Native Supabase Auth with automated token refreshing and session persistence.
- **Authorization**: Row-Level Security (RLS) policies enforce database access control.
- **Admin RBAC**: Protected admin routes (`/admin/*`) require admin identity verification against the database.
- **Secret Safety**: Private API secrets remain exclusively server-side in `server.ts` or environment variables and are never bundled into client JavaScript.
