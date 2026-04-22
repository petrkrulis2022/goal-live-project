# Netlify Deployment Guide

## Quick Setup

### 1. Connect Repository

- Go to [Netlify](https://app.netlify.com)
- Click **"Add new site"** → **"Import an existing project"**
- Connect your GitHub repository: `petrkrulis2022/goal-live-project`
- Select branch: `solana-sportsdata`
- Build command will auto-fill: `npm run build:admin`
- Publish directory: `dist-admin`
- Click **"Deploy site"**

### 2. Configure Environment Variables

After connecting the repository, go to **Site Settings → Environment** and add:

```
VITE_SUPABASE_URL=https://weryswulejhjkrmervnf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc
VITE_ADMIN_ADDRESS=0xcb443c2db4025128964397CCb5BC4F4E8ab6A665
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

**Note:** These values are already configured in the code. Just copy/paste them into Netlify.

### 3. What Gets Deployed

Your Netlify deployment includes:

- **Landing Page** (`/`) - Public marketing site with hero, features, CTA
- **Beta Registration** (`/beta`) - Sign up form for beta testers
- **Contact Page** (`/contact`) - Contact form
- **Admin Dashboard** (`/admin/dashboard`) - Beta tester management (auth required)
- **Admin Messages** (`/admin/messages`) - Contact message inbox (auth required)
- **Event Management Platform** (`/dashboard`) - Match creation & betting management (auth required)

### 4. Authentication

The admin sections use MetaMask wallet authentication:

- Users connect MetaMask at `/admin`
- Only the admin wallet (`VITE_ADMIN_ADDRESS`) can access protected pages
- Public landing pages have no authentication requirement

### 5. Routing

Netlify is configured with a rewrite rule that redirects all non-existent routes to `/index.html`, enabling React Router to handle client-side routing:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This allows React Router to manage all routes on the client side.

### 6. Verify Deployment

After deployment:

1. Visit your Netlify URL (e.g., `https://goal-live-xxx.netlify.app`)
2. You should see the landing page with:
   - Hero section: "Bet on the Match While You Watch It"
   - Three feature tiles with cyan colors
   - "Click to visit →" link to Futard.io on fundraising tile
3. Test navigation to `/beta` and `/contact`
4. Verify `/admin` shows the MetaMask login screen

### 7. Future Updates

Every push to the `solana-sportsdata` branch will automatically trigger a new Netlify deployment. You can monitor builds in the **Deployments** tab.

## Environment Variables Reference

| Variable                 | Purpose                           | Required |
| ------------------------ | --------------------------------- | -------- |
| `VITE_SUPABASE_URL`      | Supabase project URL              | ✅ Yes   |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key for frontend    | ✅ Yes   |
| `VITE_ADMIN_ADDRESS`     | MetaMask admin wallet address     | ✅ Yes   |
| `VITE_SOLANA_NETWORK`    | Solana network (devnet/mainnet)   | ✅ Yes   |
| `VITE_SOLANA_RPC_URL`    | Solana RPC endpoint               | ✅ Yes   |
| `VITE_USE_MOCK`          | Use mock data (true/false)        | ❌ No    |
| `VITE_DEBUG`             | Enable debug logging (true/false) | ❌ No    |

## Troubleshooting

### Build fails with "VITE_SUPABASE_URL not defined"

- Check that environment variables are set in Netlify
- Go to **Site Settings → Build & Deploy → Environment** and verify all vars are present
- Trigger a rebuild after adding variables

### "Unable to fetch registrations" error on admin dashboard

- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Verify Supabase project is accessible and `beta_testers` table exists

### Admin dashboard shows "Unauthorized"

- Verify MetaMask is connected to the correct wallet
- Check that the connected wallet matches `VITE_ADMIN_ADDRESS`
- Switch accounts in MetaMask to the correct admin wallet

## Local Development

To test locally before deploying:

```bash
npm run dev:admin
```

This starts the admin build at `http://localhost:5174` with your local environment variables.

## Support

For issues or questions, refer to the main [README.md](./README.md) or check the development roadmap in [DEVELOPMENT_ROADMAP.md](./docs/DEVELOPMENT_ROADMAP.md).
