<div align="center">
  <h1>🚀 CoachKit</h1>
  <p><strong>Open-source marketing automation for coaches, consultants & solopreneurs</strong></p>
  <p>Stop paying $500+/month for marketing tools. CoachKit gives you everything — for free.</p>

  <p>
    <a href="https://github.com/krishna-build/claude-coach-kit/stargazers"><img src="https://img.shields.io/github/stars/krishna-build/claude-coach-kit?style=social" alt="Stars"></a>
    <a href="https://github.com/krishna-build/claude-coach-kit/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License"></a>
    <a href="https://github.com/krishna-build/claude-coach-kit/issues"><img src="https://img.shields.io/github/issues/krishna-build/claude-coach-kit" alt="Issues"></a>
    <img src="https://img.shields.io/badge/Built%20with-Claude-blueviolet" alt="Built with Claude">
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
    <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React">
  </p>

  <p>
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

## 💡 Why CoachKit?

Most coaches and solopreneurs pay **$200-500/month** for tools like HubSpot, ActiveCampaign, or ConvertKit. CoachKit replaces all of them with a **single open-source toolkit** that you own and control.

| Feature | HubSpot | ConvertKit | CoachKit |
|---------|---------|------------|----------|
| Email sequences | ✅ $800/mo | ✅ $66/mo | ✅ **Free** |
| Payment tracking | ❌ | ❌ | ✅ **Free** |
| UTM attribution | ✅ $800/mo | ❌ | ✅ **Free** |
| Analytics dashboard | ✅ $800/mo | ✅ $66/mo | ✅ **Free** |
| Lead management | ✅ $800/mo | ✅ $66/mo | ✅ **Free** |
| Self-hosted | ❌ | ❌ | ✅ **Yes** |

---

## ✨ Features

### 📧 Email Automation
- **Multi-step nurture sequences** — automatically enroll new leads
- **Payment recovery emails** — recover failed payments with automated follow-ups
- **Smart stop rules** — sequences pause when leads convert
- **HTML template engine** — beautiful emails with personalization tokens

### 💰 Payment Tracking
- **Razorpay webhook integration** — real-time payment capture
- **Lifecycle tagging** — Lead → Paid → Call Booked → Purchased
- **Revenue attribution** — trace every payment to its source ad
- **Refund detection** — automatic status updates

### 📊 UTM Attribution Engine
- **Server-side visitor tracking** — capture UTM parameters on page load
- **Payment-visitor matching** — link ad clicks to payments automatically
- **Cloudflare geolocation** — free city detection (no API key needed)
- **Campaign analytics** — performance breakdown by campaign, creative, and audience

### 📋 Lead Management
- **Google Sheet sync** — bidirectional import from existing spreadsheets
- **Smart deduplication** — match by email and phone
- **Contact timeline** — full journey from first click to purchase
- **Bulk operations** — tag, segment, export, and manage at scale

### 📈 Analytics Dashboard
- **9-page dashboard** — contacts, segments, sequences, attribution, revenue
- **Real-time metrics** — delivery rates, open rates, conversion rates
- **Campaign comparison** — side-by-side ad performance
- **Revenue tracking** — daily, weekly, monthly breakdowns

---


## 📸 Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Contacts Management
![Contacts](docs/screenshots/contacts.png)

### UTM Attribution Analytics
![Attribution](docs/screenshots/attribution.png)


## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Ad Platforms   │────▶│  Landing Page     │────▶│   Razorpay      │
│  (Meta/Google)   │     │  (your website)   │     │  (payment)      │
└─────────────────┘     └──────┬───────────┘     └────────┬────────┘
                               │                          │
                    UTM tracking script            Webhook (payment)
                               │                          │
                    ┌──────────▼──────────────────────────▼────────┐
                    │              Supabase                         │
                    │  ┌──────────┐  ┌───────────┐  ┌───────────┐ │
                    │  │ Contacts │  │ Visitors  │  │ Sequences │ │
                    │  └──────────┘  └───────────┘  └───────────┘ │
                    │  ┌──────────┐  ┌───────────┐  ┌───────────┐ │
                    │  │ Payments │  │ Campaigns │  │ Analytics │ │
                    │  └──────────┘  └───────────┘  └───────────┘ │
                    └──────────────────┬───────────────────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │  React Dashboard    │
                            │  (9 pages)          │
                            └─────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + Vite + TailwindCSS | Fast, modern, beautiful |
| **Database** | Supabase (PostgreSQL) | Free tier, real-time, auth |
| **Edge Functions** | Supabase Edge Functions (Deno) | Serverless webhooks |
| **Email** | Resend API / Any SMTP | Flexible, affordable |
| **Payments** | Razorpay | India-first, extensible to Stripe |
| **Hosting** | Netlify / Vercel / Cloudflare Pages | Free tier available |
| **Analytics** | Recharts + Custom tracking | No third-party dependencies |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- [Supabase](https://supabase.com) account (free tier works)
- Email provider (Resend API key OR any SMTP)

### Installation

```bash
# Clone the repository
git clone https://github.com/krishna-build/claude-coach-kit.git
cd coachkit

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

Visit `http://localhost:5173` — your dashboard is live! 🎉

### Database Setup

```bash
# Push schema to Supabase
npx supabase db push

# Or run migrations manually
npx supabase migration up
```

---

## 📁 Project Structure

```
coachkit/
├── src/
│   ├── components/          # Reusable UI (Layout, Modals, Charts)
│   ├── pages/               # Dashboard pages (20+ pages)
│   │   ├── Dashboard.tsx    # Overview & stats
│   │   ├── Contacts.tsx     # Lead management
│   │   ├── Sequences.tsx    # Email automation
│   │   ├── Attribution.tsx  # UTM analytics
│   │   ├── Analytics.tsx    # Revenue & performance
│   │   ├── MetaAds.tsx      # Ad campaign tracking
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Supabase client, helpers
│   └── types/               # TypeScript definitions
├── supabase/
│   ├── functions/           # Edge functions
│   │   ├── razorpay-webhook/   # Payment processing
│   │   ├── track-visitor/      # UTM tracking
│   │   ├── email-engine/       # Email sending
│   │   └── sync-master-sheet/  # Google Sheet sync
│   └── migrations/          # Database schema
├── scripts/                 # Automation (cron jobs)
└── docs/                    # Documentation
```

---

## 🤝 Who Is This For?

- 🧑‍🏫 **Coaches** running paid programs who need lead nurturing
- 💼 **Consultants** automating their sales pipeline
- 🚀 **Solopreneurs** who can't afford enterprise marketing tools
- 👩‍💻 **Developers** building marketing tools for clients
- 🌍 **Anyone** who believes marketing automation should be free and open

---

## 🗺️ Roadmap

- [x] Email nurture sequences
- [x] Payment recovery automation
- [x] Razorpay webhook integration
- [x] UTM attribution system
- [x] Google Sheet bidirectional sync
- [x] 9-page analytics dashboard
- [x] Contact lifecycle management
- [x] Campaign performance tracking
- [ ] WhatsApp Cloud API integration
- [ ] Stripe payment support
- [ ] Multi-tenant mode (SaaS)
- [ ] AI-powered email copywriting
- [ ] Booking system (Cal.com alternative)

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
# Fork → Clone → Branch → Code → PR
git checkout -b feature/your-feature
git commit -m "Add: your feature"
git push origin feature/your-feature
```

---

## 📄 License

[MIT](LICENSE) — use it, modify it, ship it. Free forever.

---

## 💬 Story

> "I'm a solo entrepreneur from India. I needed marketing automation for my coaching clients but couldn't afford HubSpot or ActiveCampaign. So I built CoachKit with Claude as my AI development partner. No team, no funding — just one person and an AI. Now I'm open-sourcing it so every coach and solopreneur can have enterprise-grade automation for free."

---

<div align="center">
  <p><strong>If CoachKit saves you money, give it a ⭐</strong></p>
  <p>Made with ❤️ in India</p>
</div>
