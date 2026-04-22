# Quick Fix for Beta Testers Database

## Problem

You're seeing: "Could not find the table 'public.beta_testers' in the schema cache"

## Solution - 2 Simple Steps

### Step 1: Copy the SQL

Open this file: `SETUP_BETA_TESTERS.sql`
Copy ALL the SQL code (it's all SQL, no code)

### Step 2: Paste in Supabase

1. Go to: https://supabase.com/dashboard
2. Click your "goal-live" project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Paste the SQL
6. Click **RUN**

That's it! Your database is now set up.

## Verify It Worked

After running the SQL, go to: http://localhost:5174/admin/dashboard

- Click **Refresh** button
- Your registrations should appear!

## Still Getting Errors?

Make sure you copied **SQL code only** - NOT any JavaScript/TypeScript code
