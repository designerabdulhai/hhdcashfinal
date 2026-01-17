# HhdCash Pro Deployment Guide

Follow these steps to deploy your multi-category cashbook system to Vercel with a Supabase backend.

## 1. Database Setup (Supabase)
1.  Create a new project at [supabase.com](https://supabase.com).
2.  Open the **SQL Editor** in the Supabase dashboard.
3.  Copy and paste the contents of `database_setup.sql` and click **Run**.
4.  Go to **Project Settings > API** and copy your `URL` and `anon public` key.

## 2. Vercel Deployment
1.  Push your code to a GitHub repository.
2.  Import the repository into [Vercel](https://vercel.com).
3.  In the **Environment Variables** section, add the following (Vite requires the `VITE_` prefix):
    - `VITE_SUPABASE_URL`: (Your Supabase Project URL)
    - `VITE_SUPABASE_KEY`: (Your Supabase Anon Public Key)
4.  Click **Deploy**. Vercel will automatically detect the Vite build settings.

## 3. Initial Setup (The Master Owner)
1.  Open your deployed URL.
2.  On the Login screen, click **"Setup New Business Account"**.
3.  Register with your details. Since the database is empty, you will automatically be assigned the **OWNER** role.
4.  Once logged in, go to the **Admin Portal** to add categories and register staff members.

## Security Note
The system uses Phone Numbers as unique identifiers. Ensure you use strong passwords for all accounts. Owners have full control over staff access and ledger visibility.