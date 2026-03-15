# ❓ Frequently Asked Questions

## 🚀 Getting Started

### Q: How much does Coach Automation Kit cost?
**A: It's completely free!** Coach Automation Kit is open-source (MIT license). You only pay for the services you choose:
- **Supabase**: Free tier covers most small businesses
- **Email provider**: Resend ($20/mo for 100k emails) or free SMTP
- **Payment gateway**: Standard transaction fees (2.5% for Razorpay/Stripe)
- **Hosting**: Free on Netlify/Vercel/Cloudflare Pages

**Total monthly cost: $0-50 vs $200-800 for HubSpot/ActiveCampaign**

### Q: How long does setup take?
**A: About 30 minutes** for a basic setup, 2-3 hours for full configuration including:
- Database setup (10 minutes)
- Email provider configuration (5 minutes)
- Payment gateway setup (15 minutes)
- Domain and hosting deployment (15-30 minutes)
- First email sequence creation (30 minutes)

### Q: Do I need coding skills?
**A: Basic technical skills help**, but not required for daily use:
- **Setup**: Requires following terminal commands and configuration
- **Daily use**: Point-and-click dashboard like any SaaS tool
- **Customization**: HTML/CSS knowledge helpful for email templates
- **Advanced features**: JavaScript knowledge for custom integrations

### Q: Can I migrate from HubSpot/ActiveCampaign/ConvertKit?
**A: Yes!** Coach Automation Kit includes migration tools:
- **CSV import** for contacts from any platform
- **Google Sheets sync** for ongoing data management
- **Email template converter** for existing campaigns
- **UTM data preservation** for attribution history

---

## 🛠️ Technical Questions

### Q: What happens if Supabase goes down?
**A: Multiple backup options:**
- **Self-hosted Supabase**: Deploy on your own servers
- **PostgreSQL migration**: Export data to any PostgreSQL database
- **Database backups**: Automated daily backups included
- **Multiple regions**: Deploy across different geographic regions

### Q: How do I handle GDPR compliance?
**A: Built-in privacy features:**
- **Cookie-free tracking**: No consent banners needed for UTM tracking
- **Data retention policies**: Automatic cleanup after configurable periods
- **Opt-out mechanisms**: One-click unsubscribe in all emails
- **Data export**: Contacts can download their complete data
- **Right to deletion**: Bulk delete contacts and associated data

### Q: Can it handle high email volumes?
**A: Scales to millions of emails:**
- **Resend**: 100k emails/month on basic plan, scales higher
- **SMTP**: Use Amazon SES, SendGrid, or any bulk email provider
- **Queue system**: Background processing prevents timeouts
- **Rate limiting**: Automatic throttling to prevent blacklisting

### Q: What about email deliverability?
**A: Enterprise-grade deliverability:**
- **Authentication**: Automatic SPF, DKIM, and DMARC setup
- **Reputation management**: Shared IP pools with good senders
- **Bounce handling**: Automatic suppression of invalid emails
- **Spam monitoring**: Built-in content analysis
- **Dedicated IPs**: Available on higher Resend/SMTP tiers

---

## 💼 Business Questions

### Q: Can I use this for clients/agencies?
**A: Absolutely!** Perfect for agencies and consultants:
- **Multi-tenant deployment**: One instance, multiple client dashboards
- **White-label options**: Remove branding and add your own
- **Client billing**: Track usage and bill accordingly
- **Reseller licensing**: MIT license allows commercial use

### Q: How does attribution work across devices?
**A: Advanced cross-device tracking:**
- **Email matching**: Links mobile ad clicks to desktop purchases via email
- **UTM persistence**: 30-day attribution window in localStorage
- **Session stitching**: Combines multiple touchpoints per user
- **Fallback attribution**: Last-click model when cross-device fails

### Q: What payment gateways are supported?
**A: Multiple options:**
- ✅ **Razorpay** (India) - Full integration included
- ✅ **Stripe** (Global) - Integration available
- 🔄 **PayPal** - Coming soon
- 🔄 **Square** - Planned for Q3 2024
- 🔄 **Indian gateways** - CCAvenue, PayU, Instamojo planned

### Q: Can I integrate with my existing website?
**A: Yes, multiple integration methods:**
- **JavaScript tracking**: Add UTM script to any website
- **API integration**: Send form data via REST API
- **Webhook endpoints**: Receive data from any platform
- **Zapier integration**: Connect via webhooks (no official Zap yet)

---

## 🔧 Customization & Extensions

### Q: Can I customize the dashboard?
**A: Fully customizable:**
- **Themes**: Light/dark mode, custom CSS
- **Layout**: Rearrange dashboard widgets
- **Branding**: Add your logo and colors
- **Custom pages**: Add new React components
- **Metrics**: Create custom analytics views

### Q: How do I add new integrations?
**A: Built for extensibility:**
- **Edge Functions**: Add new Supabase functions for webhooks
- **React components**: Build new dashboard pages
- **Database schema**: Extend tables with custom fields
- **API endpoints**: Create custom endpoints for integrations

### Q: Can I connect to other CRMs?
**A: Multiple sync options:**
- **REST API**: Push/pull data with any modern CRM
- **Google Sheets**: Bidirectional sync as intermediate layer
- **CSV exports**: Regular bulk exports to other systems
- **Webhook broadcasting**: Send events to multiple systems

### Q: What about WhatsApp integration?
**A: WhatsApp Cloud API integration:**
- 🔄 **Coming in Q2 2024**: WhatsApp message automation
- **Features planned**: Template messages, conversation tracking
- **Compliance**: Opt-in mechanisms for WhatsApp messaging
- **Multichannel**: Unified dashboard for email + WhatsApp

---

## 🚨 Troubleshooting

### Q: My emails aren't sending. What's wrong?
**A: Common solutions:**
1. **Check API keys**: Verify Resend/SMTP credentials in `.env`
2. **Domain verification**: Ensure sending domain is verified
3. **Rate limits**: Check if you've hit provider limits
4. **Sequence status**: Verify email sequence is active
5. **Contact status**: Ensure contact hasn't unsubscribed

### Q: UTM tracking isn't working. How to fix?
**A: Debugging steps:**
1. **Script placement**: Ensure tracking script is in `<head>` section
2. **CORS settings**: Add your domain to Supabase allowed origins
3. **Function deployment**: Verify `track-visitor` function is live
4. **Browser testing**: Check network tab for 200 responses
5. **Parameter testing**: Use simple UTM parameters first

### Q: Payment webhooks are failing. What to check?
**A: Webhook troubleshooting:**
1. **URL accessibility**: Ensure webhook URL is publicly reachable
2. **SSL certificate**: Razorpay requires HTTPS endpoints
3. **Function logs**: Check Supabase function logs for errors
4. **Signature validation**: Verify webhook signature is correct
5. **Retry mechanism**: Check Razorpay webhook retry settings

### Q: Database queries are slow. How to optimize?
**A: Performance optimization:**
1. **Add indexes**: Create indexes on frequently queried columns
2. **Query limits**: Add LIMIT to large data queries
3. **Pagination**: Implement cursor-based pagination
4. **Caching**: Use React Query for client-side caching
5. **Connection pooling**: Ensure proper connection management

---

## 📊 Analytics & Reporting

### Q: How accurate is the attribution tracking?
**A: High accuracy with known limitations:**
- ✅ **Same-device accuracy**: 95%+ when user completes journey on same device
- ✅ **Email attribution**: 90%+ when email is consistent across touchpoints
- ⚠️ **Cross-device**: 60-70% accuracy (industry standard limitation)
- ⚠️ **Safari ITP**: iOS 14+ tracking limited due to Apple privacy features

### Q: Can I export analytics data?
**A: Multiple export options:**
- **CSV exports**: All dashboard data available as CSV
- **API access**: Programmatic access to all metrics
- **Google Sheets**: Live sync for external reporting
- **Dashboard embedding**: Iframe embed for client portals

### Q: What metrics are tracked?
**A: Comprehensive analytics:**
- **Attribution**: Source, medium, campaign performance
- **Email**: Open rates, click rates, conversion rates
- **Revenue**: Daily/weekly/monthly breakdowns
- **Conversion funnels**: Visitor → Lead → Customer
- **Cohort analysis**: Customer lifetime value tracking

---

## 🌍 International Usage

### Q: Does it work outside India?
**A: Global compatibility:**
- ✅ **Email**: Resend and SMTP work worldwide
- ✅ **Database**: Supabase has global regions
- ✅ **Hosting**: Netlify/Vercel serve globally
- ⚠️ **Payments**: Razorpay is India-focused, use Stripe for international

### Q: Multi-language support?
**A: Internationalization ready:**
- **Dashboard**: Currently English, i18n framework included
- **Email templates**: Support for any language/script
- **Time zones**: Automatic conversion based on contact location
- **Currency**: Multi-currency payment tracking

### Q: What about data residency requirements?
**A: Flexible deployment options:**
- **EU regions**: Deploy Supabase in EU for GDPR compliance
- **US regions**: AWS/GCP regions available
- **Self-hosted**: Complete control over data location
- **Hybrid**: Mix of cloud and on-premise components

---

## 🤝 Support & Community

### Q: Where can I get help?
**A: Multiple support channels:**
1. **Documentation**: Comprehensive guides and tutorials
2. **GitHub Issues**: Bug reports and feature requests
3. **Discussions**: Community Q&A and sharing
4. **Discord**: Real-time chat with other users (coming soon)

### Q: How do I contribute to the project?
**A: We welcome contributions:**
1. **Code**: Submit pull requests for features/fixes
2. **Documentation**: Improve guides and tutorials
3. **Testing**: Report bugs and edge cases
4. **Translations**: Help localize the platform
5. **Integrations**: Build connectors to new services

### Q: Is commercial support available?
**A: Professional services available:**
- **Setup assistance**: Paid setup and configuration
- **Custom development**: Feature development contracts
- **Priority support**: Dedicated support channels
- **Training**: Team training and best practices
- **Consulting**: Marketing automation strategy

### Q: What's the project roadmap?
**A: Upcoming features (2024):**
- ✅ Q1: WhatsApp Cloud API integration
- ✅ Q1: Stripe payment support  
- 🔄 Q2: AI-powered email copywriting
- 🔄 Q2: Advanced segmentation rules
- 🔄 Q3: Built-in landing page builder
- 🔄 Q4: Multi-tenant SaaS mode

---

## 💡 Best Practices

### Q: What's the optimal email sequence length?
**A: Depends on your audience:**
- **B2C coaches**: 5-7 emails over 2 weeks
- **B2B consultants**: 8-12 emails over 4-6 weeks
- **High-ticket services**: 15+ emails over 2-3 months
- **Nurture sequences**: Ongoing weekly value emails

### Q: How many UTM parameters should I use?
**A: Start simple, expand gradually:**
- **Essential**: utm_source, utm_medium, utm_campaign
- **Useful**: utm_content (for A/B testing ad creative)
- **Advanced**: utm_term (for keyword tracking)
- **Avoid**: Too many custom parameters (causes confusion)

### Q: What's a good email open rate?
**A: Industry benchmarks:**
- **Coaching industry**: 20-25% average
- **Nurture sequences**: 25-35% typical
- **Promotional emails**: 15-20% expected
- **Segmented emails**: 30-40% achievable

Still have questions? [Create a GitHub issue](https://github.com/krishna-build/coach-automation-kit/issues/new) and we'll add it to this FAQ!