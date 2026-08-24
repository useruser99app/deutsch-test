# NORAV V0.1 — Foundation

KI-first internationale Rekrutierungsplattform: verbindet internationale
Kandidat/innen (ca. 80 % Ausbildung, 20 % Fachkräfte) mit Arbeitgebern in
Deutschland.

Dieser Stand ist **Meilenstein 1–3A** (Foundation, Daten & Sicherheit,
Approval-Proof-of-Concept). Marketplace, KI-Integration und Payments folgen in
späteren Meilensteinen.

## Stack

- Next.js (App Router) + React + TypeScript
- Supabase: PostgreSQL, Auth, Storage, Row Level Security
- next-intl (Locales: `de`, `en`, `fr`, `ar` — Arabisch mit strukturellem RTL)
- Vercel-kompatibel

## Kernprinzip: Verifizierte Daten

Kandidat/innen ändern kanonische Daten **nie** direkt. Jede Änderung läuft als
Change-Set (`candidate_change_sets` / `candidate_change_items`, JSONB-Werte)
durch Admin-Review. Erst die Freigabe schreibt den Wert in das kanonische
Modell — durchgesetzt auf Datenbankebene (SECURITY-DEFINER-Funktionen + RLS),
nicht nur in der UI. Dokumente folgen demselben Muster inkl.
Supersede-Historie. Die zukünftige KI-Extraktion nutzt exakt denselben
Workflow (`source = 'ai_extraction'`).

## Marketplace-Architekturentscheidung (vorbereitet, nicht gebaut)

Veröffentlichte anonymisierte Profile sollen später **ohne**
Arbeitgeber-Konto einsehbar sein. Migration `…0008_public_profiles.sql`
bereitet das auf Datenbankebene vor: `anon` darf ausschließlich
`candidate_profiles` mit `profile_status = 'published'` und deren
Lokalisierungen mit `translation_status = 'approved'` lesen. Identität,
Kontaktdaten, Dokumente, Storage-Pfade, ausstehende Änderungen und
Admin-Daten bleiben für `anon` vollständig gesperrt. Die „Request
Introduction“-Aktion bleibt authentifizierungspflichtig
(Insert-Policy auf `interest_requests` nur für aktive Arbeitgeber).

## Setup

1. **Supabase-Projekt anlegen** (https://supabase.com).
2. **Datenbank einrichten** — zwei Wege:
   - **Einfach (empfohlen für die Ersteinrichtung):** den gesamten Inhalt
     von `supabase/setup-all.sql` im Supabase SQL-Editor einfügen und
     einmal ausführen. Die Datei enthält alle Migrationen plus Seed.
   - **Regulär:** alle Dateien aus `supabase/migrations/` in Reihenfolge
     (per Supabase CLI `supabase link && supabase db push` oder einzeln im
     SQL-Editor), danach `supabase/seed.sql`.

   Verbindliche Quelle für spätere Änderungen bleiben die Einzeldateien in
   `supabase/migrations/`; `setup-all.sql` wird daraus generiert.
3. **Auth-Konfiguration** (Dashboard → Authentication):
   - Sign-ups deaktivieren („Allow new users to sign up“ = off) — Konten
     werden ausschließlich vom Admin angelegt (§3A).
   - Site URL + Redirect URL: `NEXT_PUBLIC_SITE_URL` + `/auth/callback`.
   - Für E-Mail-Einladungen: SMTP konfigurieren. Ohne SMTP im Admin-UI die
     Option „Einladungslink erzeugen“ verwenden oder `npm run seed:dev`.
4. **Environment**: `.env.example` nach `.env.local` kopieren und Werte
   eintragen. Secrets niemals committen; in Vercel/CI als Environment
   Secrets hinterlegen.
5. `npm install && npm run dev`

### Erster Admin

Der erste Admin wird einmalig per Service-Role angelegt:
`npm run seed:dev` erzeugt Dev-Konten (Admin, 2 Kandidaten, Arbeitgeber)
mit pro Lauf generierten Passwörtern (nur Konsolenausgabe). Alternativ im
Supabase-Dashboard einen User mit `app_metadata`
`{"norav_role":"admin","norav_account_status":"active"}` anlegen.

## Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run seed:dev` | Dev-Testkonten (ohne SMTP) |
| `npm run test:workflow` | Pflichttest §34 gegen das echte Supabase-Projekt |

## Struktur

- `src/app/[locale]/…` — lokalisierte Routen; geschützte Bereiche
  `/admin`, `/candidate`, `/employer` (+ Login/Passwort-Flows)
- `src/app/auth/callback` — Supabase-E-Mail-Link-Callback
- `src/lib/supabase/` — Browser-/Server-/Admin-Clients (Service-Role nur
  serverseitig)
- `src/lib/actions/` — Server Actions (Auth, Kandidat, Admin)
- `messages/*.json` — Übersetzungskataloge (de/en/fr/ar)
- `supabase/migrations/` — Schema, Workflows, RLS
- `scripts/` — Seed- und Testskripte
- `legacy/` — vorheriger Repo-Inhalt (telc-B1-Übungstest), unverändert

## Environment-Variablen

| Variable | Sichtbarkeit | Zweck |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Anon-Key (RLS-geschützt) |
| `SUPABASE_SERVICE_ROLE_KEY` | **nur Server** | Kontoerstellung/Skripte |
| `NEXT_PUBLIC_SITE_URL` | Client | Basis-URL für Auth-Redirects |
