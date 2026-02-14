# LA Dog Dispatch - Automated Rescue Coordination Platform

An automated platform that coordinates urgent dog rescues from LA County shelters, connecting donors, rescues, fosters, transporters, and volunteers.

## 🚀 Features

### Automated Workflows
- **Auto-scrapes PetHarbor** euthanasia lists every hour
- **Instant dog profiles** with donation pages
- **Email notifications** to subscribers when urgent dogs are added
- **Goal tracking** with visual thermometers
- **Status updates** (urgent → funded → rescued → adopted)

### User Roles
1. **Donors** - Contribute to specific dogs or general fund
2. **Vetted Rescues** - Claim dogs and request fund transfers
3. **Foster Network** - Apply and get matched with dogs
4. **Transporters** - Claim transport requests
5. **Dog Walkers** - Volunteer for dog care
6. **Discount Vets** - Provide medical services
7. **Social Media Sharers** - Amplify urgent cases
8. **Admins** - Manage all operations

### Categories
- 🏥 **Medical Rescue** - Dogs needing urgent medical care
- 🚨 **ICE Detainment Rescue** - Dogs whose owners were detained
- 💔 **Dog Parent Death Rescue** - Dogs who lost their owners
- 🐕 **General Rescue** - Standard urgent cases

## 📦 What's Included

### Backend (Node.js + Express)
- RESTful API with authentication (JWT)
- PostgreSQL database with full schema
- PetHarbor auto-scraper (runs hourly)
- Email notification system (ready for SendGrid/Mailgun)
- Payment integration setup (Stripe ready)
- Admin dashboard API

### Frontend
- Public urgent dogs page with filtering
- Fundraising thermometers for each dog
- Category filters
- Mobile-responsive design
- Real-time stats dashboard

## 🛠️ Deployment Instructions

### Step 1: Set Up Railway

1. Go to [railway.app](https://railway.app) and sign up (FREE)
2. Click "New Project"
3. Select "Empty Project"
4. Click "Create" - you now have your project!

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database"
3. Choose "PostgreSQL"
4. Railway will automatically create the database and provide a `DATABASE_URL`

### Step 3: Upload This Code

**Option A: Using GitHub (Recommended)**
1. Create a new GitHub repository
2. Upload all these files to your repo
3. In Railway, click "+ New" → "GitHub Repo"
4. Select your repository
5. Railway will automatically deploy!

**Option B: Using Railway CLI**
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Deploy: `railway up`

### Step 4: Set Environment Variables

In Railway, go to your project → Variables tab and add:

```
JWT_SECRET=your-random-secret-key-here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
VENMO_HANDLE=@LADogDispatch
PAYPAL_EMAIL=donate@ladogdispatch.com
ZELLE_EMAIL=rescue@ladogdispatch.com
CASHAPP_HANDLE=$LADogDispatch
FRONTEND_URL=https://ladogdispatch.com
NODE_ENV=production
```

**Note:** `DATABASE_URL` is automatically provided by Railway!

### Step 5: Connect Your Domain

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add a CNAME record:
   - Name: `@` (or `www`)
   - Value: Your Railway app URL (found in Railway Settings)
3. In Railway, go to Settings → Domains
4. Click "Custom Domain"
5. Enter `ladogdispatch.com`
6. Wait 10-30 minutes for DNS to propagate

## 🎯 First Steps After Deployment

### 1. Create Admin Account

Visit your site and register with:
- Role: Select "admin" (you'll need to manually update the first user to admin in the database)

**To make first user admin:**
1. In Railway, click on your PostgreSQL database
2. Click "Query" tab
3. Run: `UPDATE users SET role = 'admin' WHERE id = 1;`

### 2. Set Up Payment Processing

**For Stripe:**
1. Sign up at [stripe.com](https://stripe.com)
2. Get your API keys from Dashboard
3. Add to Railway environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

**For GiveButter:**
1. Create campaigns at [givebutter.com](https://givebutter.com)
2. Update the GiveButter links in your environment variables

### 3. Configure Email Notifications

**Using Gmail:**
1. Enable 2-factor authentication on your Gmail
2. Generate an "App Password"
3. Add to Railway environment variables

**OR use SendGrid (recommended for production):**
1. Sign up at [sendgrid.com](https://sendgrid.com) (free tier: 100 emails/day)
2. Get API key
3. Update email configuration in code

## 📊 How It Works

### Automated Workflow

```
1. PetHarbor Scraper runs every hour
   ↓
2. New urgent dogs added to database
   ↓
3. Dog profiles created automatically
   ↓
4. Email alerts sent to subscribers
   ↓
5. Donors contribute via multiple methods
   ↓
6. When goal reached, rescues can claim dog
   ↓
7. Transport coordinated
   ↓
8. Donors receive updates
```

### API Endpoints

#### Public (No Auth Required)
- `GET /api/dogs` - List all urgent dogs
- `GET /api/dogs/:id` - Get dog details
- `GET /api/dogs/stats/overview` - Get statistics
- `POST /api/donations` - Record a donation
- `POST /api/notifications/subscribe` - Subscribe to alerts

#### Authenticated
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/dogs` - Add dog manually (rescue/admin)
- `POST /api/rescues/claim/:dogId` - Claim dog (rescue)
- `POST /api/fosters/apply` - Submit foster application
- `POST /api/transport/claim/:id` - Claim transport

#### Admin Only
- `GET /api/admin/stats` - Full dashboard stats
- `GET /api/admin/rescues/pending` - Pending rescue verifications
- `PATCH /api/admin/rescues/:id/verify` - Approve rescue
- `GET /api/admin/fosters/pending` - Pending foster apps
- `PATCH /api/admin/fosters/:id/status` - Approve foster

## 🔧 Customization

### Change Payment Handles
Edit `.env` file or Railway environment variables:
```
VENMO_HANDLE=@YourHandle
PAYPAL_EMAIL=youremail@domain.com
```

### Adjust Scraping Frequency
```
PETHARBOR_SCRAPE_INTERVAL=30  # minutes
```

### Modify Default Fundraising Goal
In `routes/dogs.js`, change line 47:
```javascript
goal_amount || 500  // Change 500 to your default
```

## 💰 Costs

- **Railway**: FREE for first $5/month usage, then ~$5-10/month
- **Domain**: ~$12/year (already purchased: ladogdispatch.com)
- **Email**: FREE (SendGrid free tier) or use Gmail
- **Stripe**: 2.9% + $0.30 per transaction
- **Total**: ~$5-15/month

## 🆘 Troubleshooting

### "Database connection failed"
- Make sure PostgreSQL is added to your Railway project
- Check that `DATABASE_URL` environment variable exists

### "PetHarbor scraping not working"
- PetHarbor may have changed their HTML structure
- Check logs in Railway dashboard
- Update selectors in `services/petharborScraper.js`

### "Can't add dogs"
- Make sure you're logged in with admin/rescue role
- Check browser console for errors
- Verify JWT_SECRET is set in environment variables

## 📞 Support

For issues or questions:
1. Check Railway logs (Dashboard → Deployments → View Logs)
2. Review browser console (F12 → Console tab)
3. Check this README for solutions

## 🔐 Security Notes

- **Never commit `.env` file** to GitHub (it's in `.gitignore`)
- Change `JWT_SECRET` to a random 32+ character string
- Use strong passwords for admin accounts
- Enable HTTPS (Railway provides this automatically)

## 📈 Future Enhancements

- [ ] SMS notifications (Twilio integration)
- [ ] Social media auto-posting
- [ ] Mobile app (React Native)
- [ ] Volunteer scheduling system
- [ ] Advanced matching algorithm for fosters
- [ ] Integration with other shelter databases
- [ ] Automated thank-you emails
- [ ] Monthly donor reports

---

**Built for LA Dog Dispatch**  
Saving dogs, one dispatch at a time. 🐕❤️
