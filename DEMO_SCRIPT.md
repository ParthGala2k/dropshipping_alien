# 30-Second Demo Script

1. **Start**  
   - Server: `npm run dev:server` (with `DEV_BYPASS_AUTH=true` in `server/.env`)  
   - Client: `npm run dev:client`  
   - Open http://localhost:5173  

2. **Login**  
   - Click **Demo login** in the header.  

3. **Queue → Ticket**  
   - Go to **Events** → open “Neon Nights Festival” (or any event).  
   - Click **Join queue**.  
   - Wait for “Your turn” (or reload / wait ~5s for tick).  
   - When the modal appears, click **Claim ticket** within 90 seconds.  
   - You’re redirected to **My** with a new ticket.  

4. **Resale**  
   - On **My**, find your ticket → **List for resale** → enter price (e.g. `5000` cents) → **List**.  
   - Go to **Resale** → see your listing → (as same or another user) click **Buy**.  
   - **My** → ticket is gone from “My tickets”; buyer has it.  

5. **Merch**  
   - **Merch** → **List item** → title “Alien Cap”, price e.g. `19.99` → **Create**.  
   - Click **Order** on the new listing.  
   - **My** → **Orders on my listings** → **Mark shipped**.  

6. **Agent Assist**  
   - On event detail or **Resale**, click **Agent Assist** to see a suggestion (no state change without your approval).  

Done in under a minute.
