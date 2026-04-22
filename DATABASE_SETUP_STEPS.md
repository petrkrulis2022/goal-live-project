# Database Setup - Step by Step

## What to Do

You made a mistake by copying **TypeScript code** instead of **SQL code**.

### ❌ Wrong

```
import { useEffect, useState } from "react";
```

### ✅ Correct

```
CREATE TABLE IF NOT EXISTS public.beta_testers (
```

## Follow These Steps Exactly

### 1️⃣ Open the SQL File

In VS Code, open this file from the project:

- File path: `goal.live/SETUP_BETA_TESTERS.sql`
- This file contains ONLY SQL code (no TypeScript!)

### 2️⃣ Copy All the SQL

- Select all text in `SETUP_BETA_TESTERS.sql`
- Press `Ctrl+A` (or `Cmd+A` on Mac)
- Press `Ctrl+C` (or `Cmd+C`) to copy

### 3️⃣ Go to Supabase

- Visit: https://supabase.com/dashboard
- Select your **goal-live** project
- Click **SQL Editor** in the left sidebar
- Click **New Query** button

### 4️⃣ Paste the SQL

- Click in the query editor area
- Press `Ctrl+V` (or `Cmd+V`) to paste
- You should see the SQL code appear

### 5️⃣ Run It

- Click the **RUN** button (blue button, bottom right)
- Wait for it to complete
- You should see: "Query successful" or similar message

### 6️⃣ Verify

- Go to: http://localhost:5174/admin/dashboard
- Click the **Refresh** button
- Your registration should now appear!

## Troubleshooting

**Still seeing the error?**

- Make sure you copied from `SETUP_BETA_TESTERS.sql` (SQL file)
- NOT from `AdminDashboard.tsx` (TypeScript file)
- The SQL should start with: `-- COPY AND PASTE THIS`

**SQL runs but registrations still don't show?**

- The table was created successfully
- Your registration data is there (it was saved when you submitted the form)
- Dashboard just needs a moment to sync
- Try clicking Refresh again after a few seconds

**New error in SQL Editor?**

- Copy the exact content from `SETUP_BETA_TESTERS.sql`
- Make sure nothing else is selected
- Paste it ALL into one query
- Click RUN once
