# ColdReach AI — Gmail Cold Email Outreach Platform

ColdReach AI is a production-grade cold email automation platform designed for high-deliverability internship, job application, and sales outreach. It connects directly to your authorized Google Gmail account via the official **Google Gmail API (OAuth 2.0)**, sending identical cold emails with your uploaded resume PDF attached separately to every recipient—**no CC, no BCC, and no shared threads**.

---

## 🌟 Key Features

1. **Official Gmail API Delivery (`users.messages.send`)**:
   - Zero simulation: emails actually leave your authorized personal Gmail or Google Workspace inbox.
   - Guaranteed individual delivery: every recipient is placed solely in the `To:` header.
   - Preserves SPF, DKIM, and DMARC reputation from your personal Google account.

2. **Recipient Management**:
   - **Method A (Paste):** Paste raw lists separated by newlines, commas, or semicolons (supports `"Name" <email>` syntax).
   - **Method B (CSV Upload):** Flexible parser supporting `email`, `name`, `company`, `position` (only `email` mandatory, case-insensitive headers, BOM-safe).
   - **Method C (Manual Entry):** Add recipients one by one with metadata.
   - **Auto-Validation & Deduplication:** RFC 5322 regex checks, case-insensitive deduplication, flag invalid addresses, and suppression list filtering.
   - **Downloadable CSV Template:** Built-in template generator.

3. **Email Composer & Resume PDF Handling**:
   - Common subject line and common body for the entire outreach batch (guaranteed unchanged).
   - **Single PDF Upload:** Upload your resume PDF once (e.g. `Ekaagra_Gupta_Resume.pdf`).
   - **Binary Signature Inspection:** Validates magic bytes (`%PDF-`) and MIME type to ensure only genuine, clean PDF documents are attached.
   - **Private Server-Side Storage:** PDF attachments are stored outside of `/public` and are never exposed via public static URLs.
   - **Compliant RFC 2822 / MIME Construction:** Uses `multipart/mixed` and `multipart/alternative`, with base64 encoded attachments and proper line wrapping.

4. **Safety & Campaign Controls**:
   - **Send Test Email:** Send an instant test email to your own address with the exact subject, body, and attached resume PDF before launching.
   - **Explicit Confirmation Modal:** Requires confirmation before initiating sends.
   - **Throttling & Backoff:** Configurable delay between emails (default 3s) to avoid Google burst rate limits.
   - **Cancellation & Pause:** Stop remaining unsent emails at any time.
   - **Live Progress Monitor:** Real-time polling with progress bar and recipient activity table (Sent, Failed, Gmail Message IDs, timestamps, errors).
   - **CSV Export:** Download full campaign activity logs as CSV.

5. **Enterprise-Grade Security**:
   - Refresh tokens and access tokens are encrypted at rest using **AES-256-GCM** with a 32-byte secret key and unique 12-byte initialization vectors (IV).
   - Scopes are restricted to the absolute minimum needed: `gmail.send`, `userinfo.email`, and `userinfo.profile`.
   - Credentials and tokens are strictly kept on the server and never sent to frontend bundles.

---

## 🏗️ Architecture & Technology Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, TypeScript, React 18)
- **Styling & UI:** Tailwind CSS, custom design inspired by Linear, Resend, and Stripe (Dark/Light mode)
- **Email Engine:** Official [`googleapis`](https://github.com/googleapis/google-api-nodejs-client) Gmail v1 Client
- **Database & ORM:** Prisma ORM with SQLite (zero-config, file-based persistence at `./prisma/coldreach.db`, seamlessly swappable to PostgreSQL)
- **CSV Engine:** [PapaParse](https://www.papaparse.com/)
- **Security:** Node.js `crypto` with `aes-256-gcm`
- **Testing:** [Vitest](https://vitest.dev/) unit and integration test suite

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (Node v20+ recommended)
- **npm** or **pnpm**
- A **Google Cloud Account** (free tier is completely sufficient)

### 2. Installation
Clone and navigate into the project directory:
```bash
cd /Users/apple/.gemini/antigravity/scratch/coldreach-ai
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Ensure your `.env.local` contains:
```env
DATABASE_URL="file:./coldreach.db"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Google Cloud OAuth 2.0 Credentials (see section below)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# 32-byte hex key for AES-256-GCM encryption
ENCRYPTION_KEY="1ab003d75849370369f0aae56e0f70dd15453590da0f2d03e1bcb0e7c2f28ad7"

# Upload and sending settings
UPLOAD_DIR="./uploads/resumes"
MAX_UPLOAD_SIZE_MB=25
DEFAULT_SEND_INTERVAL_SEC=3
DAILY_SEND_LIMIT=500
```

### 4. Database Setup
Initialize the database and generate the Prisma Client:
```bash
npx prisma db push
```

### 5. Run the Test Suite
Verify that all validation, MIME generation, encryption, and campaign logic pass:
```bash
npm test
```

### 6. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Google Cloud Console Setup Guide

To send emails through your real Gmail account, follow these 5 steps in the Google Cloud Console:

### Step 1: Create a Project
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**.
3. Name your project (e.g. `ColdReach-Automation`) and click **Create**.

### Step 2: Enable the Gmail API
1. Navigate to **APIs & Services → Library**.
2. Search for `Gmail API`.
3. Select **Gmail API** and click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services → OAuth consent screen**.
2. Choose User Type: **External** and click **Create**.
3. Fill in the required fields:
   - **App name:** `ColdReach AI`
   - **User support email:** Your Gmail address
   - **Developer contact information:** Your Gmail address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**:
   - Manually enter or check: `https://www.googleapis.com/auth/gmail.send`
   - Also add: `https://www.googleapis.com/auth/userinfo.email` and `https://www.googleapis.com/auth/userinfo.profile`
6. Click **Update** and **Save and Continue**.
7. Under **Test Users**:
   - Click **+ Add Users** and enter your personal Gmail address.
   - *Note:* In "Testing" publishing status, only explicitly added test users can authorize the app.
8. Click **Save and Continue**.

### Step 4: Create OAuth 2.0 Credentials
1. Go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. Set **Application type** to: `Web application`.
4. Set **Name** to: `ColdReach Web Client`.
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```text
   http://localhost:3000/api/auth/google/callback
   ```
6. Click **Create**.
7. A dialog will appear with your **Client ID** and **Client Secret**.

### Step 5: Add Credentials to `.env.local`
Paste the Client ID and Secret into `.env.local`:
```env
GOOGLE_CLIENT_ID="123456789-abcdef.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
```
Restart your development server:
```bash
npm run dev
```

---

## 📖 End-to-End User Guide

### 1. Connect Your Gmail Account
- Open the application and navigate to **Settings & OAuth** (or click the **Connect Gmail** banner).
- Click **Connect Gmail Account**.
- You will be redirected to Google’s OAuth consent screen.
- Log in and grant the single permission to send emails on your behalf.
- If Google displays *"Google hasn't verified this app"*, click **Advanced → Go to ColdReach AI (unsafe)** (this is standard for personal developer apps in testing mode).
- Upon return, your connected Gmail address is displayed with a green active indicator.

### 2. Create a Campaign
- Click **New Campaign** in the sidebar.
- **Step 1: Recipients:**
  - Paste email addresses, upload a CSV file, or add contacts manually.
  - Inspect the validation overview: see valid count, duplicates removed, and invalid flagged addresses.
  - Click **Proceed to Message & Resume**.
- **Step 2: Message & Resume:**
  - Review the read-only `From` and `To` indicators.
  - Enter your common subject line (e.g. `Software Engineer Application — Ekaagra Gupta`).
  - Enter your common email body.
  - Upload your resume PDF once (validated for `%PDF` header and size <= 25MB).
  - Use the **Preview** button to verify the uploaded PDF.
  - Adjust the sending delay (default: 3 seconds).
  - Click **Review Campaign & Send**.
- **Step 3: Review & Confirmation:**
  - Review all summary cards (sending account, total recipients, estimated duration).
  - Click **Send Test Email** to send a real email with attachment to your own inbox.
  - Click **Send Campaign (N Recipients)**.
  - Read the confirmation modal and click **Yes, Send Campaign**.

### 3. Live Monitoring & Export
- The app automatically routes you to the **Campaign Activity Monitor**.
- Watch the live progress bar update as emails are sent sequentially.
- The table displays real-time statuses (`SENT`, `FAILED`), timestamps, and actual Google Gmail Message IDs.
- Click **Export CSV Results** to download an audit spreadsheet of the entire outreach run.
- Use **Cancel Remaining Sends** at any time if you wish to abort unsent messages.

---

## 🛡️ Gmail Quotas & Responsible Outreach Best Practices

Google enforces daily sending quotas to preserve email deliverability and combat spam:
- **Free Gmail accounts (`@gmail.com`):** **500 emails per rolling 24 hours**.
- **Google Workspace accounts (`@yourcompany.com`):** **2,000 emails per rolling 24 hours**.
- **ColdReach AI safeguards:**
  - The sending engine introduces a default delay (3–5 seconds) between messages to prevent Google burst rate flags.
  - If a 403 quota error is returned, the engine immediately pauses the campaign to prevent account suspensions.
  - Built-in duplicate detection and suppression list ensure no recruiter or contact is inadvertently messaged twice.

---

## 🗄️ Switching to PostgreSQL (Production Deployment)

By default, ColdReach AI runs zero-config on SQLite (`coldreach.db`). To switch to a production PostgreSQL database (e.g. Neon, Supabase, RDS):
1. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Update `DATABASE_URL` in `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/coldreach?sslmode=require"
   ```
3. Run:
   ```bash
   npx prisma db push
   ```

---

## 🧪 Automated Testing

ColdReach AI includes an extensive test suite covering:
- **Email format validation & RFC 5322 compliance**
- **CSV parsing, header normalization, and BOM handling**
- **Case-insensitive recipient deduplication**
- **Binary PDF signature validation (`%PDF-`) and size enforcement**
- **RFC 2822 MIME multipart construction with base64 encoded attachments**
- **AES-256-GCM encryption, decryption, and tamper detection**
- **Campaign creation, status transitions, and cancellation**

Run tests:
```bash
npm test
```
Run tests in watch mode:
```bash
npm run test:watch
```

---

## 📄 License

MIT. Built for high-integrity professional outreach.
