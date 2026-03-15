# 🏗️ Architecture Overview

Coach Automation Kit is designed as a **serverless-first, event-driven marketing automation platform**. This document explains the system architecture, data flow, and technical decisions.

## 🎯 Design Principles

### 1. **Serverless-First**
- No servers to manage or scale
- Pay only for what you use
- Automatic scaling with traffic

### 2. **Event-Driven Architecture**
- Real-time data processing via webhooks
- Asynchronous email processing
- Reactive UI updates

### 3. **Open Source & Self-Hostable**
- Full source code transparency
- Deploy anywhere (Netlify, Vercel, self-hosted)
- No vendor lock-in

### 4. **API-First Design**
- Every feature accessible via API
- Easy integrations with external tools
- Modular and extensible

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  React SPA (9 pages)         │  Landing Page Integration             │
│  ┌─────────────────────┐    │  ┌─────────────────────────────────┐  │
│  │ • Dashboard         │    │  │ UTM Tracking Script             │  │
│  │ • Contacts          │    │  │ • Captures visitor data         │  │
│  │ • Sequences         │    │  │ • Stores in localStorage        │  │
│  │ • Attribution       │    │  │ • Sends to Supabase             │  │
│  │ • Analytics         │    │  └─────────────────────────────────┘  │
│  │ • Meta Ads          │    │                                       │
│  │ • Revenue           │    │                                       │
│  │ • Settings          │    │                                       │
│  │ • Import/Export     │    │                                       │
│  └─────────────────────┘    │                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│                    Supabase (PostgreSQL + Auth)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Contacts   │ │  Visitors   │ │ Sequences   │ │  Payments   │   │
│  │  (CRM data) │ │ (UTM data)  │ │(Email auto) │ │ (Revenue)   │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Campaigns   │ │ Analytics   │ │   Emails    │ │   Settings  │   │
│  │ (Meta/Ads)  │ │ (Metrics)   │ │ (Templates) │ │   (Config)  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVERLESS FUNCTIONS                           │
├─────────────────────────────────────────────────────────────────────┤
│              Supabase Edge Functions (Deno Runtime)                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │ razorpay-       │ │ track-visitor   │ │ email-engine    │       │
│  │ webhook         │ │ • UTM capture   │ │ • Send emails   │       │
│  │ • Payment sync  │ │ • Geo detection │ │ • Sequence mgmt │       │
│  │ • Status update │ │ • Attribution   │ │ • Template eng  │       │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │ sync-master-    │ │ meta-ads-sync   │ │ analytics-      │       │
│  │ sheet           │ │ • Campaign data │ │ compute         │       │
│  │ • Sheets API    │ │ • Performance   │ │ • Daily metrics │       │
│  │ • Bi-directional│ │ • Cost tracking │ │ • Revenue calc  │       │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL INTEGRATIONS                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Razorpay   │ │   Resend    │ │Google Sheets│ │   Meta API  │   │
│  │ (Payments)  │ │  (Email)    │ │    (CRM)    │ │  (Ad Data)  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Cloudflare  │ │    SMTP     │ │   Stripe    │ │  WhatsApp   │   │
│  │   (Geo)     │ │  (Email)    │ │ (Payments)  │ │ (Messaging) │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

### Core Tables

#### `contacts`
Primary CRM table storing lead and customer information.

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR,
  name VARCHAR,
  status VARCHAR DEFAULT 'lead', -- lead|paid|call_booked|purchased
  source VARCHAR, -- utm_source value
  medium VARCHAR, -- utm_medium value  
  campaign VARCHAR, -- utm_campaign value
  tags TEXT[], -- flexible tagging system
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

#### `visitors`
UTM tracking and attribution data.

```sql
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR NOT NULL,
  utm_source VARCHAR,
  utm_medium VARCHAR,
  utm_campaign VARCHAR,
  utm_term VARCHAR,
  utm_content VARCHAR,
  page_url VARCHAR,
  referrer VARCHAR,
  ip_address INET,
  user_agent TEXT,
  city VARCHAR,
  country VARCHAR,
  created_at TIMESTAMP DEFAULT now()
);
```

#### `payments`
Transaction tracking with attribution.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  visitor_id UUID REFERENCES visitors(id), -- attribution link
  gateway_id VARCHAR UNIQUE, -- razorpay_payment_id
  amount INTEGER, -- amount in cents
  currency VARCHAR DEFAULT 'INR',
  status VARCHAR, -- captured|failed|refunded
  gateway_data JSONB, -- raw webhook data
  created_at TIMESTAMP DEFAULT now()
);
```

#### `sequences`
Email automation workflows.

```sql
CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  trigger_event VARCHAR, -- new_contact|payment_failed|tag_added
  trigger_conditions JSONB,
  emails JSONB, -- array of email objects
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

### Relationships & Indexing

```sql
-- Performance indexes
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_visitors_session ON visitors(session_id);
CREATE INDEX idx_payments_contact ON payments(contact_id);
CREATE INDEX idx_payments_gateway ON payments(gateway_id);

-- Attribution relationship
CREATE INDEX idx_payments_visitor ON payments(visitor_id);
```

## 🔄 Data Flow

### 1. **Visitor Tracking Flow**
```
User clicks ad → Landing page → UTM script → track-visitor function → visitors table
```

1. User clicks Facebook/Google ad with UTM parameters
2. Landing page loads with tracking script
3. Script captures UTM data and sends to `track-visitor` function
4. Function stores data in `visitors` table with session ID
5. Data stored in localStorage for payment attribution

### 2. **Contact Creation Flow**
```
Form submission → Frontend → Supabase → Sequence trigger → Email automation
```

1. User fills contact form on landing page
2. Frontend creates contact record in `contacts` table
3. Database trigger fires for new contact
4. Email sequence automatically enrolls new contact
5. First nurture email sent within 5 minutes

### 3. **Payment Attribution Flow**
```
Payment → Webhook → Attribution matching → Revenue tracking
```

1. User completes payment on Razorpay
2. Razorpay sends webhook to `razorpay-webhook` function
3. Function matches payment to contact via email
4. Function links payment to visitor session via localStorage data
5. Complete attribution chain: Ad → Visitor → Contact → Payment

### 4. **Email Automation Flow**
```
Trigger event → Sequence engine → Email templates → Delivery
```

1. Event occurs (new contact, payment failed, tag added)
2. Sequence engine checks active sequences for triggers
3. Email content generated with personalization tokens
4. Email queued and sent via Resend/SMTP
5. Delivery status tracked in `emails` table

## 🧩 Component Architecture

### Frontend (React)

```
src/
├── pages/              # Route-level pages
│   ├── Dashboard.tsx   # Overview metrics
│   ├── Contacts.tsx    # CRM interface
│   ├── Sequences.tsx   # Email automation
│   ├── Attribution.tsx # UTM analytics
│   └── Analytics.tsx   # Revenue dashboard
├── components/         # Reusable UI components
│   ├── Layout/         # Navigation, sidebar
│   ├── Charts/         # Data visualization  
│   ├── Forms/          # Contact forms, settings
│   └── Modals/         # Pop-up dialogs
├── hooks/              # Custom React hooks
│   ├── useSupabase.ts  # Database operations
│   ├── useAnalytics.ts # Metrics calculations
│   └── useSequences.ts # Email automation
└── lib/               # Utilities and clients
    ├── supabase.ts    # Database client
    ├── email.ts       # Email helpers
    └── analytics.ts   # Metrics functions
```

### Backend (Supabase Edge Functions)

```
supabase/functions/
├── razorpay-webhook/      # Payment processing
│   ├── index.ts          # Main handler
│   └── payment-sync.ts   # Business logic
├── track-visitor/        # UTM tracking
│   ├── index.ts          # Main handler
│   └── geo-lookup.ts     # Location detection
├── email-engine/         # Email automation
│   ├── index.ts          # Main handler
│   ├── sequence-runner.ts # Automation logic
│   └── template-engine.ts # Email rendering
└── sync-master-sheet/    # Google Sheets sync
    ├── index.ts          # Main handler
    └── sheet-operations.ts # Sheets API
```

## 🔐 Security Architecture

### Authentication
- **Supabase Auth** for dashboard access
- **Row Level Security (RLS)** for data isolation
- **API key rotation** for external services

### Data Protection
- **Environment variables** for sensitive credentials
- **Webhook signature validation** for payment security
- **CORS configuration** for frontend security
- **Rate limiting** on Edge Functions

### Privacy Compliance
- **Cookie-free tracking** for better privacy
- **Opt-out mechanisms** for email sequences
- **Data retention policies** for GDPR compliance

## ⚡ Performance Considerations

### Database Performance
- **Indexes** on frequently queried columns
- **Pagination** for large datasets
- **Connection pooling** via Supabase
- **Query optimization** using `explain analyze`

### Frontend Performance
- **Code splitting** by route
- **Lazy loading** of heavy components
- **React Query** for data caching
- **Virtual scrolling** for large tables

### Edge Function Performance
- **Cold start optimization** (< 100ms)
- **Minimal dependencies** in Deno runtime
- **Async processing** for non-critical tasks
- **Response streaming** for large payloads

## 🔄 Scaling Strategy

### Vertical Scaling (Single Tenant)
- Supabase automatically scales PostgreSQL
- Edge Functions scale to zero and up automatically
- Frontend served from global CDN

### Horizontal Scaling (Multi-Tenant)
- **Database sharding** by tenant ID
- **Function isolation** per tenant
- **Custom domain** per tenant

### Cost Optimization
- **Edge Functions** cheaper than traditional servers
- **Supabase free tier** covers early usage
- **CDN caching** reduces database load
- **Background jobs** for heavy processing

## 🧪 Testing Strategy

### Unit Tests
```bash
npm run test              # Frontend component tests
npm run test:functions    # Edge Function tests
```

### Integration Tests
```bash
npm run test:e2e          # End-to-end workflows
npm run test:webhook      # Webhook processing
```

### Load Testing
- **Artillery.js** for API load testing
- **Lighthouse** for frontend performance
- **Supabase metrics** for database monitoring

## 📈 Monitoring & Observability

### Application Monitoring
- **Supabase Dashboard** for database metrics
- **Edge Function logs** for serverless monitoring
- **Frontend error tracking** via Sentry

### Business Metrics
- **Email delivery rates** via Resend webhooks
- **Payment success rates** via Razorpay dashboard
- **User engagement** via custom analytics

### Alerting
- **Database connection** health checks
- **Payment webhook** failure alerts
- **Email delivery** issue notifications

## 🚀 Deployment Architecture

### Development
```bash
npm run dev              # Local development server
npx supabase start       # Local Supabase stack
npx supabase functions serve  # Local Edge Functions
```

### Production
```bash
npm run build            # Static site generation
npx supabase deploy      # Edge Functions deployment
# Deploy to Netlify/Vercel/Cloudflare Pages
```

### CI/CD Pipeline
1. **GitHub Actions** trigger on push
2. **Run tests** and security scans
3. **Build** frontend and functions
4. **Deploy** to staging environment
5. **Run smoke tests**
6. **Deploy** to production

This architecture provides a **scalable, maintainable, and cost-effective** solution for marketing automation that can grow from startup to enterprise scale.