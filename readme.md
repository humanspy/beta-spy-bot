# Spy Group Discord Bot -- BETA

A **modular, production-grade Discord bot** built for community servers, featuring advanced (manual) moderation, music playback, leveling with role rewards, and ModMail with forum tickets.

This bot is designed with **clean architecture**, **central routing**, and **server-scoped data isolation**.

---

## ✨ Features

### 🛡 Moderation

* Warnings, timeouts, bans, hackbans
* Full case system with logging
* Override ban codes
* Permission-based staff hierarchy
* Integrated moderation workflows
* Staff role assignment tracking persisted in MySQL

### 🎵 Music

* Play music from URLs or search queries
* Queue, skip, pause, stop
* Per-guild volume
* Auto-disconnect when idle

### 📈 Leveling System

* XP gain from messages
* Rank command
* Server leaderboard
* Fully server-scoped leveling data

### 🏷 Level Roles (Wizard-Based)

* Assign roles at specific levels (up to level 100)
* Configurable level interval
* Optional removal of previous roles
* Interactive setup wizard using:

  * embeds
  * buttons
  * modals
* Preview & confirmation before saving

### 📬 ModMail (Forum-Based)

* Users DM the bot to open tickets
* Ticket types:

  * Question
  * Bug
  * Ban Appeal (limited per user)
  * Custom server-defined types
* Tickets are created as **forum posts**
* Open / Closed tags
* Closed tickets are automatically locked
* Anonymous staff replies (optional)
* Appeal usage tracking per user

## 🧾 Staff Role Assignment Tracking

The bot writes a global table that records which users hold each staff role per guild. This
table is fully refreshed on startup, updated when staff config is saved, and synced whenever
member roles change (so the table stays global, not per-guild).

**Example: saving role assignments to the table when a member changes roles**

```js
import { syncMemberStaffRoleAssignments } from "./moderation/staffRoleAssignments.js";
import { getStaffConfig } from "./moderation/staffConfig.js";

// Inside a GuildMemberUpdate handler:
const config = await getStaffConfig(newMember.guild);
await syncMemberStaffRoleAssignments(newMember, config.staffRoles);
// This will insert or delete rows like:
// { guild_id: "123", staff_role_id: "999", user_id: "555", role_level: 0, updated_at: "..." }
```

**Example usage (querying sorted by `guild_id`):**

```js
import { getStaffRoleAssignmentsSorted } from "./moderation/staffRoleAssignments.js";

const assignments = await getStaffRoleAssignmentsSorted();
console.log(assignments.slice(0, 3));
// [
//   { guild_id: "123", staff_role_id: "999", user_id: "555", role_level: 0, updated_at: "..." },
//   { guild_id: "123", staff_role_id: "999", user_id: "777", role_level: 0, updated_at: "..." },
//   { guild_id: "456", staff_role_id: "888", user_id: "111", role_level: 3, updated_at: "..." }
// ]
```

---

## 📁 Project Structure

```text
.
├─ index.js                # Main bot entry
├─ router.js               # Central slash command router
├─ deploy-commands.js      # Slash command deployment
├─ guild-commands.js       # Guild slash command definitions
│
├─ moderation/
│  ├─ commands/
│  ├─ core.js
│  └─ storage/
│
├─ music/
│  ├─ player.js
│  ├─ queue.js
│  └─ commands/
│
├─ profile/
│  └─ level/
│     ├─ xp.js
│     ├─ storage.js
│     ├─ levelRoles.js
│     ├─ lvlrolesWizard.js
│     ├─ core.js
│     └─ commands/
│
├─ modmail/
│  ├─ commands/
│  ├─ core.js
│  ├─ dmHandler.js
│  ├─ ticketManager.js
│  └─ storage/
│
└─ utils/
```

---

## ⚙️ Installation

### Requirements

* Node.js **18+**
* Discord Bot Token

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
```

---

## 🚀 Deployment

### Register slash commands

```bash
node deploy-commands.js
```

### Start the bot

```bash
node index.js
```

---

## 📜 Slash Commands

### Moderation

* `/warn add | remove`
* `/timeout add | remove`
* `/ban add | remove`
* `/case view | remove`
* `/purge`
* `/generatebancode`
* `/help`

### Music

* `/play`
* `/pause`
* `/stop`
* `/skip`
* `/queue`
* `/current`
* `/volume`

### Leveling

* `/rank`
* `/leaderboard`

### Level Roles

* `/lvlroles setup`
* `/lvlroles config`

### ModMail

* `/modmail setup`
* `/modmail settings`

---

## 🧠 Architecture Overview

* **Central Router (`router.js`)**

  * Routes slash commands to feature modules
* **Component Handlers**

  * Buttons, modals, and selects handled separately
* **Server-Scoped Data**

  * No cross-guild data leaks
* **Single Source of Truth**

  * Configs stored in structured JSON files
* **No Client-Side Trust**

  * Permissions always validated server-side

---

## 🔐 Security Model

* Confirmation system for destructive actions
* Permission enforcement (backend)

---

## 🧩 Extensibility

Designed to easily support:

* additional ticket types
* more music providers
* new moderation actions
* analytics & logging
* transcript exports
* API extensions

---

## 📌 Notes

* Each server runs **fully isolated**
* Bot owners do **not** see other servers’ data
* Appeals are rate-limited per user
* Closed ModMail tickets are locked automatically

---

## 📄 License

This project is private and intended for Spy Group servers.
All rights reserved.


