# 🚀 QUICK START GUIDE - LA Dog Dispatch

## Deploy to Railway in 10 Minutes

### STEP 1: Download Your Files
You should have received a ZIP file with all the code. Extract it to a folder.

### STEP 2: Railway Setup (2 minutes)

1. Go to https://railway.app
2. Click "Login with GitHub" or create account
3. Click "New Project"
4. Select "Empty Project"
5. Your project is created! ✅

### STEP 3: Add Database (1 minute)

1. In your Railway project, click "+ New"
2. Click "Database"
3. Select "PostgreSQL"
4. Done! Railway automatically connects it ✅

### STEP 4: Deploy Your Code (3 minutes)

**EASIEST METHOD - Upload via GitHub:**

1. Go to https://github.com
2. Click "New repository"
3. Name it: `la-dog-dispatch`
4. Upload all your files to this repo
5. Back in Railway, click "+ New"
6. Select "GitHub Repo"
7. Choose `la-dog-dispatch`
8. Railway starts deploying automatically! ✅

**Watch the deploy logs** - it takes 2-3 minutes

### STEP 5: Add Environment Variables (2 minutes)

In Railway, click on your service → Variables tab

**Add these variables** (click "Add Variable" for each):

```
JWT_SECRET = mysupersecretkey123
VENMO_HANDLE = @LADogDispatch
PAYPAL_EMAIL = donate@ladogdispatch.com
ZELLE_EMAIL = rescue@ladogdispatch.com
CASHAPP_HANDLE = $LADogDispatch
NODE_ENV = production
```

**Optional (add later):**
```
EMAIL_HOST = smtp.gmail.com
EMAIL_PORT = 587
EMAIL_USER = your-email@gmail.com
EMAIL_PASSWORD = your-app-password
```

Click "Deploy" (if it doesn't auto-redeploy)

### STEP 6: Get Your URL (1 minute)

1. In Railway, click "Settings" tab
2. Under "Domains", you'll see your app URL
3. Click it! Your site is LIVE! 🎉

Example: `la-dog-dispatch-production.up.railway.app`

### STEP 7: Connect ladogdispatch.com (5 minutes)

1. In Railway Settings → Domains
2. Click "Custom Domain"
3. Enter: `ladogdispatch.com`
4. Railway shows you DNS records

5. Go to your domain registrar (where you bought the domain)
6. Find "DNS Settings" or "Manage DNS"
7. Add the CNAME record Railway gave you:
   - Type: CNAME
   - Name: @ (or www)
   - Value: [Railway's URL]

8. Wait 10-30 minutes for DNS to propagate
9. Visit https://ladogdispatch.com - YOU'RE LIVE! 🚀

## First Login

1. Visit your site
2. Click "Admin" → should show login form
3. For now, you can view the public dogs page

**To create admin account**, you'll need to:
1. Register a regular account
2. In Railway, click on PostgreSQL database
3. Click "Query" tab
4. Run: `UPDATE users SET role = 'admin' WHERE id = 1;`
5. Refresh your site - you now have admin access!

## Testing the Site

1. **View urgent dogs** - Should see sample dogs from PetHarbor scraper
2. **Filter by category** - Click the category buttons
3. **Donate button** - Click on a dog to see donation modal
4. **Stats** - Top of page shows urgent, saved, total raised

## What Happens Next?

- PetHarbor scraper runs automatically every hour
- New urgent dogs appear on the site
- Donors can contribute
- Rescues can register and claim dogs
- Everything is tracked in the database

## Need Help?

**Check logs:**
Railway Dashboard → Your service → Deployments → View Logs

**Common issues:**
- "Database error" → Make sure PostgreSQL is added
- "Can't deploy" → Check GitHub repo has all files
- "Site won't load" → Check deployment logs for errors

## 💡 Tips

- Bookmark your Railway dashboard
- Set up email notifications later (not required for launch)
- Add Stripe keys when ready for real payments
- Invite team members through Railway settings

---

**YOU DID IT!** 🎉

Your automated dog rescue platform is now live and saving lives!

Visit: https://ladogdispatch.com
