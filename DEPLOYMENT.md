# Deployment Guide - Vercel

## Prerequisites

1. **Vercel Account** - Sign up at https://vercel.com
2. **GitHub Repository** - Push this code to GitHub
3. **MongoDB Atlas** - Cloud database for production (https://www.mongodb.com/cloud/atlas)

## Step 1: Set up MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Add your IP to whitelist (or allow 0.0.0.0/0 for easier setup)
4. Create a database user
5. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/factory-asset-maintenance`

## Step 2: Connect GitHub Repository

```bash
# Push your code to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 3: Deploy to Vercel

### Option A: Via Web UI
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Select your GitHub repository
4. Add environment variables (see below)
5. Click "Deploy"

### Option B: Via CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

## Step 4: Set Environment Variables in Vercel

In Vercel Dashboard → Project Settings → Environment Variables, add:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/factory-asset-maintenance
JWT_SECRET=generate-a-random-64-character-string-here
JWT_EXPIRES_IN=8h
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
BCRYPT_ROUNDS=12
ESCALATION_REJECTION_THRESHOLD=3
ESCALATION_AUTO_CANCEL_DAYS=7
```

**Generate secure JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Seed Production Database

After deployment:

```bash
# Install MongoDB CLI or use a tool to connect
# Or run this in Vercel CLI:
vercel env pull .env.production.local
npx vercel env list
```

Then run seed script against production:
```bash
MONGODB_URI="your-production-uri" NODE_ENV=production npm run seed
```

## Environment Variables Checklist

| Variable | Dev Value | Production Value |
|----------|-----------|------------------|
| `MONGODB_URI` | `mongodb://localhost:27017/...` | `mongodb+srv://...` |
| `JWT_SECRET` | `your-super-secret-key...` | Generate strong secret |
| `JWT_EXPIRES_IN` | `8h` | `8h` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://your-app.vercel.app` |
| `NODE_ENV` | `development` | `production` |
| `BCRYPT_ROUNDS` | `12` | `12` |
| `ESCALATION_REJECTION_THRESHOLD` | `3` | `3` |

## Troubleshooting

### 501 Unauthorized on login
- Check `MONGODB_URI` is correct in Vercel env vars
- Verify IP whitelist in MongoDB Atlas includes Vercel IPs
- Run seed script to populate users

### Build fails
- Ensure `npm run build` works locally first: `npm run build`
- Check TypeScript: `npm run type-check`

### CORS issues
- Update `NEXT_PUBLIC_APP_URL` in Vercel env vars

## Post-Deployment

1. Test login at: `https://your-app.vercel.app/login`
2. Use seeded credentials
3. Monitor in Vercel Dashboard

## Auto-Deployments

Every push to main branch will auto-deploy. To disable:
- Vercel Dashboard → Project Settings → Git → disable Auto-deploy
