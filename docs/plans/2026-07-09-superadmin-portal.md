# Superadmin Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a secure Superadmin panel to create, list, toggle, and delete multi-tenant event IDs ("Combos Digitales"), enforcing access verification so inactive or unregistered events are blocked.

**Architecture:** 
- Add an `events` table in Supabase (with directory mapping for local fallback).
- Implement a dedicated `/superadmin` route protected by a `superadmin_session` cookie and `requireSuperAuth` middleware.
- Add validation middleware to check that the `eventId` query parameter in all standard APIs and public routes is registered and active, serving an elegant inactive page otherwise.

**Tech Stack:** Express, Cookie Auth, Supabase (PostgREST & Storage), Vanilla CSS with Jano's Premium Gold/Charcoal aesthetics.

---

## User Review Required

> [!IMPORTANT]
> The database schema needs to be updated with the new `events` table and foreign key constraints on the existing tables. You will need to run the new script in the Supabase SQL Editor once approved.

## Proposed Changes

### 1. Database Schema Update

#### [MODIFY] [schema.sql](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/schema.sql)
Update the SQL file to include:
- `events` table.
- Foreign key references in `guests`, `config`, and `photos` tables pointing to `events(id) ON DELETE CASCADE`.
- Default inserts for legacy compatibility (`default`).

```sql
-- Create EVENTS Table
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert fallback default event if not exists
INSERT INTO public.events (id, client_name, active)
VALUES ('default', 'Default Event', true)
ON CONFLICT (id) DO NOTHING;

-- Modify existing tables to refer to events
ALTER TABLE public.guests 
ADD CONSTRAINT fk_guests_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.config 
ADD CONSTRAINT fk_config_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.photos 
ADD CONSTRAINT fk_photos_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
```

---

### 2. Database Adapter Extensions

#### [MODIFY] [db.js](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/utils/db.js)
Extend the database layer with the following methods:
- `isEventValid(eventId)`: Checks if an event is registered and active.
- `getEvents()`: Returns the list of all events.
- `createEvent(id, clientName)`: Inserts a new event.
- `toggleEvent(id, active)`: Toggles active status.
- `deleteEvent(id)`: Deletes an event.

Local file fallback:
- Keep an `events.json` in `data/` containing active events for local testing.

---

### 3. Server Endpoints & Middleware

#### [MODIFY] [server.js](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/server.js)
- **Superadmin Session Management**:
  - `SUPERADMIN_PASSWORD` env var (fallback to `'janos-superadmin'`).
  - `/api/superadmin/login` / `/api/superadmin/logout` / `/api/superadmin/check`.
  - `requireSuperAuth` middleware checking for `superadmin_session` cookie.
- **Superadmin Event Management APIs**:
  - `GET /api/superadmin/events`
  - `POST /api/superadmin/events`
  - `PUT /api/superadmin/events/:id`
  - `DELETE /api/superadmin/events/:id`
- **Validation Middleware (`validateEventAccess`)**:
  - Checks if the requested `req.query.event` (or route parameter) is active.
  - If invalid:
    - JSON APIs: Return `403 Forbidden` with `{ error: 'El Combo Digital ha expirado o no está activo.' }`.
    - HTML views: Redirect to `/inactive?event=eventId`.

---

### 4. Public & Admin Views

#### [NEW] [inactive.html](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/public/inactive.html)
- A premium, elegant, and modern block screen explaining that the event is inactive and guests should contact Jano's staff.

#### [NEW] [superadmin.html](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/private/superadmin.html)
- Clean, responsive glassmorphism portal styling.
- Features:
  - Client Management table (ID, Name, Date, Active/Inactive switch, Delete action).
  - "Crear Combo" Form with instant feedback.
  - Integration with the backend `events` APIs.

#### [NEW] [superlogin.html](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/public/superlogin.html)
- Dedicated login page for Superadmin access.

---

## Verification Plan

### Automated Tests
- Write a dedicated test suite `tests/superadmin.test.js` verifying:
  - Unregistered events are rejected by `isEventValid`.
  - Creating, listing, toggling, and deleting events isolations.
  - Run with `node tests/superadmin.test.js`.

### Manual Verification
1. Access `/?event=does-not-exist`. Verify redirection to `/inactive`.
2. Login as Superadmin at `/superlogin`.
3. Create a new event `boda-test` with client name `Boda Test`.
4. Verify that `/admin?event=boda-test` and `/?event=boda-test` now load correctly.
5. Inactivate the event from Superadmin.
6. Verify `/admin?event=boda-test` and `/?event=boda-test` are immediately blocked.
