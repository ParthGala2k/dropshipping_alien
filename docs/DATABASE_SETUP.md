# Fresh database setup (Supabase)

Follow these steps to create a new Supabase database and connect the app.

---

## 1. Create a Supabase project

1. Go to **[supabase.com](https://supabase.com)** and sign in (or create an account).
2. Click **New project**.
3. Fill in:
   - **Name** – e.g. `fair-ticket-queue`
   - **Database password** – choose a strong password and **save it** (you’ll need it for the connection string).
   - **Region** – pick one close to you.
4. Click **Create new project** and wait until the project is ready (1–2 minutes).

---

## 2. Get the connection string (use pooler)

1. In the left sidebar, click the **gear icon** → **Project Settings**.
2. Click **Database** in the left menu.
3. Scroll to **Connection pooling**.
4. Select **Session** mode.
5. In the connection string box, copy the **URI** (it looks like):
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
6. Replace **`[YOUR-PASSWORD]`** with the database password you set in step 1.

---

## 3. Put the URL in the app

1. Open **`server/.env`** in this project.
2. Set (or update) **`DATABASE_URL`** with the full connection string:
   ```env
   DATABASE_URL=postgresql://postgres.xxxxx:YourPassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
   No spaces, one line. Use your real password and the exact URI from Supabase.

---

## 4. Create the tables (run the migration)

1. In Supabase, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file **`supabase/migrations/001_initial_schema.sql`** in this repo and copy its **entire** contents.
4. Paste into the SQL Editor and click **Run** (or press Cmd/Ctrl+Enter).
5. You should see “Success. No rows returned.” The tables are now created.
6. Run the second migration: open **`supabase/migrations/002_ticket_levels_and_purchases.sql`**, copy its contents, paste in a new SQL Editor query, and run it.

---

## 5. Test the connection and seed data

From the **project root** (Dropshipping Platform folder):

```bash
node server/check-db.js
```

You should see: **Database connected successfully.**

Then seed the database (creates 3 events and a dev user):

```bash
npm run build -w server
npm run seed
```

You should see: **Seed complete: 3 events, optional dev user + 2 tickets for event 1.**

---

## 6. Run the app

```bash
npm run dev
```

Open **http://localhost:5173**, click **Demo login**, and you’re done.
