# 🚀 Getting Started with Coach Automation Kit

Welcome to Coach Automation Kit! This guide will help you set up your marketing automation system from scratch in **under 30 minutes**.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Git** - For cloning the repository
- **Supabase account** - [Sign up free](https://supabase.com)
- **Email provider** - Resend (recommended) or any SMTP service
- **Payment gateway** - Razorpay (for Indian businesses) or Stripe

## 🛠️ Step 1: Repository Setup

### Clone and Install
```bash
git clone https://github.com/krishna-build/coach-automation-kit.git
cd coach-automation-kit
npm install
```

### Environment Configuration
```bash
cp .env.example .env
```

Open `.env` and configure these essential variables:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email Configuration (choose one)
# Option 1: Resend API (recommended)
RESEND_API_KEY=your_resend_api_key

# Option 2: SMTP
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_app_password

# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Optional: Google Sheets Integration
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email
GOOGLE_SHEETS_PRIVATE_KEY=your_service_account_key
```

## 🗄️ Step 2: Database Setup

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned (~2 minutes)
3. Copy your project URL and API keys to `.env`

### Run Database Migrations
```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your_project_id

# Push database schema
npx supabase db push
```

### Verify Database Setup
Check that these tables were created in your Supabase dashboard:
- `contacts` - Lead and customer data
- `visitors` - UTM tracking data
- `sequences` - Email automation workflows
- `payments` - Transaction records
- `campaigns` - Marketing campaign data
- `analytics` - Performance metrics

## 📧 Step 3: Email Provider Setup

### Option A: Resend (Recommended)
1. Sign up at [resend.com](https://resend.com)
2. Create an API key
3. Add your domain and verify DNS records
4. Add `RESEND_API_KEY` to your `.env` file

### Option B: SMTP (Gmail, Outlook, etc.)
For Gmail:
1. Enable 2-factor authentication
2. Create an app password
3. Use these settings:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your.email@gmail.com
   SMTP_PASS=your_app_password
   ```

## 💳 Step 4: Payment Gateway Setup

### Razorpay Setup (for India)
1. Sign up at [razorpay.com](https://razorpay.com)
2. Complete KYC verification
3. Get your Key ID and Key Secret from the dashboard
4. Add webhook endpoint: `https://your-domain.com/api/razorpay-webhook`
5. Select events: `payment.captured`, `payment.failed`

### Alternative: Stripe Setup
1. Create account at [stripe.com](https://stripe.com)
2. Get publishable and secret keys
3. Configure webhook endpoint for payment events

## 🚀 Step 5: Launch Application

### Start Development Server
```bash
npm run dev
```
Your dashboard will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

## 🌐 Step 6: Deployment Options

### Option A: Netlify (Recommended)
1. Build your project: `npm run build`
2. Deploy `dist/` folder to Netlify
3. Add environment variables in Netlify settings
4. Configure Supabase Edge Functions for webhooks

### Option B: Vercel
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in your project directory
3. Add environment variables in Vercel dashboard

### Option C: Cloudflare Pages
1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables

## 🔧 Step 7: UTM Tracking Setup

### Add Tracking Script to Landing Pages
Add this script to your website's `<head>` section:

```html
<script>
(function() {
    const params = new URLSearchParams(window.location.search);
    const utmData = {
        source: params.get('utm_source'),
        medium: params.get('utm_medium'), 
        campaign: params.get('utm_campaign'),
        term: params.get('utm_term'),
        content: params.get('utm_content'),
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    };
    
    if (utmData.source) {
        fetch('https://your-project.supabase.co/functions/v1/track-visitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(utmData)
        });
        
        // Store for payment attribution
        localStorage.setItem('coachkit_utm', JSON.stringify(utmData));
    }
})();
</script>
```

## 📊 Step 8: Test Your Setup

### 1. Test Database Connection
- Visit your dashboard
- Check that all pages load without errors
- Create a test contact

### 2. Test Email Sending
- Go to Sequences page
- Create a simple email sequence
- Send a test email

### 3. Test Payment Webhook
- Create a test payment in Razorpay dashboard
- Verify payment appears in your Analytics page

### 4. Test UTM Tracking
- Visit your landing page with UTM parameters
- Check the Attribution page for visitor data

## 🔄 Step 9: Import Your Existing Data

### Google Sheets Import
1. Share your Google Sheet with the service account email
2. Use the built-in import tool in Contacts page
3. Map columns to contact fields
4. Review and import

### Manual CSV Import
1. Export contacts from your current CRM
2. Use the CSV import feature
3. Map fields and import

## 🎯 Step 10: Create Your First Campaign

### Email Sequence Setup
1. Go to Sequences → New Sequence
2. Choose trigger (e.g., "New Contact")
3. Design your email series
4. Set timing and conditions
5. Activate sequence

### UTM Campaign Tracking
1. Create UTM links for your ads:
   ```
   https://your-site.com?utm_source=facebook&utm_medium=cpc&utm_campaign=q1_coaching
   ```
2. Use these links in your Facebook/Google ads
3. Track performance in Attribution dashboard

## ❗ Common Issues & Solutions

### Database Connection Failed
- Check your Supabase URL and keys in `.env`
- Verify your project is active in Supabase dashboard
- Run `npx supabase status` to check connection

### Email Not Sending
- Verify your email provider settings
- Check API key permissions
- Test with a simple email first

### Payment Webhook Not Working
- Ensure webhook URL is publicly accessible
- Check Supabase Edge Functions are deployed
- Verify webhook signature validation

### UTM Data Not Tracking
- Check JavaScript console for errors
- Verify Edge Function endpoint is correct
- Test with simple UTM parameters first

## 📞 Need Help?

1. **Check the [FAQ](FAQ.md)** for common questions
2. **Read the [Architecture](ARCHITECTURE.md)** for technical details
3. **Search existing [GitHub issues](https://github.com/krishna-build/coach-automation-kit/issues)**
4. **Create a new issue** with detailed error information

## 🎉 You're Ready!

Congratulations! Your marketing automation system is now live. Start creating email sequences, tracking campaigns, and automating your coaching business.

**Next steps:**
- Set up your first email sequence
- Create UTM-tracked landing pages
- Connect your payment gateway
- Import your existing contacts

Happy automating! 🚀