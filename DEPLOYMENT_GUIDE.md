# 🚀 SAGE Deployment Guide

## Complete step-by-step guide to deploy SAGE to production

---

## 📋 Prerequisites

Before deploying, you need:

1. **GitHub account** (you have this ✅)
2. **Groq API key** (free) - Get at https://console.groq.com
3. **Vercel account** (free) - Sign up at https://vercel.com
4. **Railway account** (free $5 credit) - Sign up at https://railway.app
5. **Supabase account** (free) - Sign up at https://supabase.com (optional but recommended)

---

## 🎯 Deployment Architecture

```
┌─────────────────┐
│   Users/Browser │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│  Vercel (CDN)   │  ← Frontend (Next.js)
│  Frontend       │
└────────┬────────┘
         │
         │ HTTPS (API calls)
         │
┌────────▼────────┐
│ Railway Server  │  ← Backend (Node.js/Express)
│  Backend API    │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│   Supabase      │  ← Database (PostgreSQL)
│  (Optional)     │
└─────────────────┘
```

---

## 📦 Phase 1: Deploy Backend to Railway

### Step 1: Sign up for Railway

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign in with GitHub

### Step 2: Create New Project

1. Click **"Deploy from GitHub repo"**
2. Select your `ctechyard-xyz/sage` repository
3. Railway will detect it's a monorepo

### Step 3: Configure Backend Service

1. When prompted for root directory, enter: `backend`
2. Railway will auto-detect Node.js

### Step 4: Add Environment Variables

In Railway dashboard, go to your service → **Variables** tab and add:

```env
PORT=4000
NODE_ENV=production
GROQ_API_KEY=gsk_your_actual_groq_key_here
SAGE_DEFAULT_MODEL=llama-3.3-70b-versatile
SAGE_VISION_MODEL=llama-3.2-11b-vision-preview
JWT_SECRET=generate-a-random-secret-string-here
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

**How to get GROQ_API_KEY:**
1. Go to https://console.groq.com
2. Sign up/login
3. Go to API Keys → Create API Key
4. Copy the key (starts with `gsk_...`)

**How to generate JWT_SECRET:**
```bash
# On your terminal, run:
openssl rand -base64 32
# Or use: https://generate-secret.vercel.app/32
```

### Step 5: Deploy

1. Railway will automatically build and deploy
2. Wait for deployment to complete (2-3 minutes)
3. Copy your backend URL (e.g., `https://sage-backend-production.railway.app`)

### Step 6: Test Backend

Open in browser: `https://your-backend-url.railway.app/`

You should see:
```json
{
  "name": "SAGE",
  "version": "7.0",
  "status": "operational",
  ...
}
```

✅ **Backend deployed successfully!**

---

## 🎨 Phase 2: Deploy Frontend to Vercel

### Step 1: Sign up for Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Sign in with GitHub

### Step 2: Import Project

1. Click **"Add New..." → "Project"**
2. Click **"Import"** next to your `ctechyard-xyz/sage` repository
3. Vercel will detect it's a monorepo

### Step 3: Configure Frontend

1. **Root Directory**: `frontend`
2. **Framework Preset**: Next.js (auto-detected)
3. **Build Command**: `npm run build` (default)
4. **Output Directory**: `.next` (default)

### Step 4: Add Environment Variables

In the deployment settings, add:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Replace `your-backend-url.railway.app` with your actual Railway backend URL from Phase 1.

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Vercel will give you a URL (e.g., `https://sage-frontend.vercel.app`)

### Step 6: Test Frontend

1. Open your Vercel URL in browser
2. Click **"Launch Demo"**
3. You should be able to chat with SAGE!

✅ **Frontend deployed successfully!**

---

## 🔄 Phase 3: Update Backend CORS

Now that frontend is deployed, update backend to allow it:

### Step 1: Update Railway Environment Variable

In Railway dashboard → Variables, update:

```env
FRONTEND_URL=https://your-frontend-url.vercel.app
```

### Step 2: Redeploy Backend

1. In Railway, click **"Deployments"**
2. Click **"Redeploy"** on the latest deployment
3. Wait for it to restart

✅ **CORS configured!**

---

## 🗄️ Phase 4: Set Up Supabase (Optional but Recommended)

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click **"New Project"**
3. Choose a name: `sage-platform`
4. Set a database password (save it!)
5. Choose region closest to your users
6. Click **"Create new project"**

### Step 2: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the contents of `database/schema.sql` from your repo
4. Click **"Run"**

### Step 3: Get Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - Keep this secret!

### Step 4: Update Environment Variables

**Railway (Backend):**
```env
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
```

**Vercel (Frontend):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

### Step 5: Redeploy Both Services

- Railway: Redeploy backend
- Vercel: Redeploy frontend (automatic on env var change)

✅ **Database connected!**

---

## 🧪 Phase 5: Test Everything

### Test 1: Landing Page
1. Open your Vercel URL
2. You should see the SAGE landing page
3. Click "Launch Demo"
4. Should log you in without errors

### Test 2: Chat Functionality
1. Type a message: "Explain quantum computing"
2. Wait for response (should take 2-5 seconds)
3. Verify response appears

### Test 3: Image Analysis
1. Click paperclip icon
2. Upload an image
3. Add question: "What's in this image?"
4. Send and verify vision analysis works

### Test 4: Settings
1. Go to Settings page
2. Add your personal Groq API key
3. Select a different model (e.g., 8B)
4. Save and test chat

### Test 5: Error Handling
1. Try sending empty message (should show validation)
2. Try uploading large file >5MB (should show error)
3. Check browser console for any errors

---

## 🐛 Troubleshooting

### "Failed to fetch" Error

**Cause**: Frontend can't reach backend

**Solutions**:
1. Check `NEXT_PUBLIC_API_URL` in Vercel env vars
2. Verify backend is running on Railway
3. Check CORS settings in Railway env vars
4. Open browser DevTools → Network tab → see exact error

### Backend Returns 500 Error

**Cause**: Missing or invalid API key

**Solutions**:
1. Check `GROQ_API_KEY` in Railway env vars
2. Verify key starts with `gsk_`
3. Check Railway logs for detailed error

### Image Analysis Fails

**Cause**: Vision model not available or rate limited

**Solutions**:
1. Check Groq API key has vision access
2. Try smaller images (<1MB)
3. Check Railway logs for vision model errors
4. Free tier has rate limits - wait and retry

### CORS Error

**Cause**: Frontend domain not in allowed origins

**Solutions**:
1. Update `FRONTEND_URL` in Railway env vars
2. Redeploy backend
3. Clear browser cache

---

## 📊 Monitoring & Logs

### Railway Logs (Backend)
1. Go to Railway dashboard
2. Click your service
3. Click **"Deployments"** → **"View Logs"**
4. Watch for errors in real-time

### Vercel Logs (Frontend)
1. Go to Vercel dashboard
2. Click your project
3. Click **"Functions"** → **"Logs"**
4. Filter by errors

### Supabase Logs (Database)
1. Go to Supabase dashboard
2. Click **"Logs"** in sidebar
3. View database queries and errors

---

## 🔐 Security Checklist

Before going public:

- [ ] Groq API key is valid and has rate limits configured
- [ ] JWT_SECRET is a strong random string (not "change-this")
- [ ] FRONTEND_URL in Railway matches your actual Vercel domain
- [ ] CORS is properly configured (not allowing `*`)
- [ ] Supabase service_role key is NOT in frontend env vars
- [ ] No sensitive data in git history
- [ ] Rate limiting enabled on backend (already configured)
- [ ] HTTPS only (Vercel/Railway provide this automatically)

---

## 🚀 Going Live

### Custom Domain (Optional)

**Vercel:**
1. Go to Project Settings → Domains
2. Add your domain (e.g., `sage.yourdomain.com`)
3. Update DNS records as instructed
4. Update Railway `FRONTEND_URL` to new domain

**Railway:**
1. Go to Service Settings → Networking
2. Click **"Generate Domain"** or add custom domain
3. Update Vercel `NEXT_PUBLIC_API_URL` to new domain

### Performance Optimization

1. **Enable Vercel Edge Cache** (automatic)
2. **Use Railway's closest region** to your users
3. **Enable Supabase connection pooling** (automatic)
4. **Consider adding Redis** for caching (advanced)

### Scaling

**Vercel**: Auto-scales automatically (free tier: 100GB bandwidth)

**Railway**: 
- Free tier: $5 credit/month
- Hobby plan: $5/month (suitable for small projects)
- Pro plan: $20/month (for production)

**Supabase**:
- Free tier: 500MB database, 2GB bandwidth
- Pro plan: $25/month (8GB database, 250GB bandwidth)

---

## 💰 Cost Estimate (Monthly)

| Service | Free Tier | Hobby/Pro | Notes |
|---------|-----------|-----------|-------|
| Vercel | ✅ Free | $20/mo | Free is sufficient to start |
| Railway | $5 credit | $5-20/mo | Depends on usage |
| Supabase | ✅ Free | $25/mo | Free is sufficient to start |
| Groq API | ✅ Free | Pay-per-use | Free tier: 30 requests/min |
| **Total** | **$0** | **$50-65/mo** | Start free, scale as needed |

---

## 📝 Post-Deployment Checklist

- [ ] Backend responds at Railway URL
- [ ] Frontend loads at Vercel URL
- [ ] "Launch Demo" works without errors
- [ ] Chat functionality works
- [ ] Image analysis works
- [ ] Settings page saves API key
- [ ] Model selection works
- [ ] Error messages are user-friendly
- [ ] Mobile responsive (test on phone)
- [ ] No console errors
- [ ] CORS configured correctly
- [ ] Environment variables set correctly
- [ ] Database connected (if using Supabase)
- [ ] Rate limiting active

---

## 🎉 You're Live!

Your SAGE platform is now publicly accessible!

**Share your URLs:**
- Frontend: `https://your-project.vercel.app`
- Backend API: `https://your-backend.railway.app`

**Next steps:**
1. Share with beta users
2. Monitor logs for errors
3. Collect feedback
4. Plan Sprint 7 features (Memory, Audio, etc.)

---

## 📞 Need Help?

**Common Issues:**
- Deployment fails → Check build logs
- API errors → Check Railway logs
- CORS errors → Update FRONTEND_URL
- Rate limits → Upgrade Groq plan or add caching

**Resources:**
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Groq Docs: https://console.groq.com/docs

---

**Built with ❤️ by the SAGE team**  
*Think. Understand. Act. Evolve.*
