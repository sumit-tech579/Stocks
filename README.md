# TradeNest 📈
**Professional Indian Stock Market Paper-Trading Application**

Inspired by Groww's clean simplicity and intuitive design, TradeNest is a responsive, accessible paper-trading platform designed for the Indian equities market (NSE/BSE). It allows traders, students, and enthusiasts to practice trading with **₹1,00,000 in virtual money** with realistic simulated quotes, charts, and order matching—without risking any real capital.

---

## 🌟 Key Features

1. **Clean, Modern Indian Stock Interface**:
   - Clean white backgrounds, emerald-green accents, rounded-2xl cards, and subtle borders inspired by Groww's design philosophy.
   - Polished **Light and Dark modes** with automatic system-preference sync.
   - Fully responsive layout: fixed desktop sidebar and mobile bottom navigation.
   - Global keyboard-accessible stock omnisearch (**⌘K** / **Ctrl+K**).

2. **₹1,00,000 Virtual Cash & Paper Trading Engine**:
   - Every new account starts with ₹1,00,000 in virtual funds.
   - **Market Orders**: Instant execution at simulated quotes.
   - **Limit Orders**: Executes automatically when market price matches the limit condition.
   - **Cash & Share Reservations**: Prevents overspending or overselling by locking funds/shares while limit orders are pending.
   - **Instant Order Cancellation**: Cancel pending limit orders to immediately release reserved funds or shares.
   - **Atomic State Updates**: Weighted Average Cost (WAC) calculations and realized profit/loss calculations using decimal-safe arithmetic.
   - **Zero Financial Risk**: Explicit disclaimers, zero brokerage/taxes simulation, and no collection of PAN, Aadhaar, or bank details.

3. **Stock Discovery (27+ Recognisable Indian Companies)**:
   - High-profile blue chips across 7 sectors:
     - **Banking & Finance**: HDFC Bank, ICICI Bank, SBI, Kotak Mahindra, Axis Bank, Bajaj Finance.
     - **IT Services**: TCS, Infosys, Wipro, HCL Tech.
     - **Oil, Gas & Energy**: Reliance Industries, ONGC, NTPC, Power Grid.
     - **Consumer Goods**: ITC, Hindustan Unilever, Titan, Asian Paints.
     - **Automobile**: Tata Motors, Maruti Suzuki, Mahindra & Mahindra.
     - **Pharmaceuticals**: Sun Pharma, Cipla, Dr. Reddy's.
     - **Infrastructure & Metals**: Larsen & Toubro, Tata Steel, UltraTech Cement.
   - Search by symbol or company name, sector filter pills, and sorting by gainers, losers, price, and name.

4. **Interactive Stock Details & Charts**:
   - Consistent generated historical charts with **1D, 1W, 1M, 3M, and 1Y** selectors matching current quotes.
   - Key market statistics: Open, High, Low, Previous Close, 52-Week Range, Volume, Market Cap, and P/E ratio.
   - One-click Watchlist bookmarking and integrated Buy/Sell drawer.

5. **Portfolio & Order Tracking**:
   - Holdings table with average cost, current price, invested value, current market value, and unrealized P&L (₹ and %).
   - Asset allocation breakdown charts (by stock or sector).
   - Order history with filters (Pending, Executed, Cancelled, Rejected).
   - One-click **CSV export** for order records and trade transaction history.
   - "Reset Demo Account" feature to revert to initial ₹1,00,000.

6. **Dual Mode: Demo Mode & Supabase Integration**:
   - Works immediately out-of-the-box in **Demo Mode** without requiring Supabase credentials.
   - Full Supabase integration (Auth, PostgreSQL, Row-Level Security) when `.env` is configured.

---

## 🚀 Beginner-Friendly Local Setup

### Prerequisites
- Node.js (v18 or higher recommended; v20+ supported).
- npm, yarn, or pnpm.

### 1. Clone & Install
```bash
# Navigate to the project directory
cd "TradeNest"

# Install dependencies
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` (or the port shown in terminal). TradeNest will launch in **Demo Mode** with ₹1,00,000 virtual cash ready to trade!

### 3. Build for Production
```bash
npm run build
npm run preview
```

---

## 🔥 Firebase Authentication Setup Instructions

TradeNest supports **Firebase Authentication** for email/password signup and 1-click **Google Sign-In**:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **"Add project"** (e.g., `tradenest-trading`).
2. Once created, in the left navigation, go to **Build** > **Authentication** and click **"Get started"**.
3. Under the **Sign-in method** tab, enable:
   - **Email/Password** (check "Enable" and save).
   - **Google** (check "Enable", pick a support email, and save).
4. In Project Settings (gear icon in top left) > **General**, scroll down to **"Your apps"** and click the Web icon (`</>`) to register a web app.
5. Copy the configuration keys and add them to your `.env` file:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=tradenest-trading.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tradenest-trading
   VITE_FIREBASE_STORAGE_BUCKET=tradenest-trading.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:...
   ```
6. Restart the server (`npm run dev`). TradeNest will automatically connect to Firebase Auth!

---

## 🗄️ Supabase Setup Instructions (Optional)

TradeNest functions completely offline in Demo Mode. If you want multi-device cloud authentication and persistent Postgres storage:

1. Go to [supabase.com](https://supabase.com) and create a free account and new project.
2. In your Supabase project dashboard, navigate to **SQL Editor**.
3. Open the migration file in this repository:
   `supabase/migrations/20240101000000_initial_schema.sql`
4. Copy and paste the entire SQL content into the Supabase SQL Editor and click **Run**. This will create:
   - `profiles`, `accounts`, `holdings`, `orders`, `transactions`, `watchlists` tables.
   - Row-Level Security (RLS) policies ensuring users only access their own private data.
   - Automatic user creation trigger that grants new signups ₹1,00,000 in virtual cash.
5. In your Supabase dashboard, go to **Project Settings** > **API**.
6. Copy the **Project URL** and the **anon/public Key**.
7. Create a `.env` file in the root of the project:
   ```bash
   cp .env.example .env
   ```
8. Fill in your keys:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
9. Restart your dev server (`npm run dev`). Users can now register, sign in, and reset passwords with real Supabase Auth!

---

## ☁️ Vercel Deployment Instructions

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Log in to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your TradeNest repository.
4. Framework Preset will be automatically detected as **Vite**.
5. (Optional) Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   *(If omitted, TradeNest will deploy in 100% functional Demo Mode).*
6. Click **Deploy**. Your app will be live with an SSL domain in under a minute!

---

## 💡 Demo Mode & Its Scope

- **Data Persistence**: When running in Demo Mode, all balances, watchlists, holdings, and order books persist safely in the browser's `localStorage`.
- **Order Execution Scope**: Real-time price fluctuations and pending limit order auto-matching run while the application tab is active in the browser. A prominent banner displays the latest quote update time.
- **Reset Capability**: At any time, you can navigate to **Account** > **Reset Demo Account** to revert your virtual balance to ₹1,00,000 and clear all positions.

---

## 🔮 Scope & Future Broker Integration Guide

This release is strictly an **educational paper-trading application**. Real-money trading is disabled.

To connect a future version of TradeNest to live financial markets:
1. **SEBI Regulations & Licensing**:
   - Operating an order-routing system in India requires registration as a SEBI-registered stock broker or an authorized sub-broker/fintech partner under circulars SEBI/HO/MIRSD/DOP/CIR/P/2022/117.
2. **Authorized Broker APIs**:
   - **Zerodha Kite Connect API** / **Upstox API** / **Angel One SmartAPI**:
   - Replace `DemoDataProvider` with an authenticated broker gateway supporting OAuth2 session tokens (`request_token` exchange).
   - Implement real-money order routing endpoints (`POST /orders/regular`) with user-authorized 2FA (TOTP/Biometric).
3. **Licensed Market-Data Feeds**:
   - Integrate licensed real-time tick-by-tick Websocket feeds (e.g., TrueData, GlobalDataFeeds, or direct exchange colocation multicast feeds).
4. **Compliance & Risk Controls**:
   - Mandatory PAN/Aadhaar KYC, IPV (In-Person Verification), and risk disclosures as prescribed by SEBI and exchange bylaws before any real capital can be traded.

---

## 🛡️ License

MIT License. Built for educational and paper-trading purposes.
