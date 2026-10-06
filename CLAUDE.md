# Agape Dating App

## 1. Projektübersicht

- Christliche Dating-App (Hinge-artiges UX) mit Fokus auf ernsthafte Beziehungen und Glaubenswerte
- Zielgruppe: Christliche Singles in Polen
- Schweiz/Bulgarien-Daten im Seed-Script sind nur für Testzwecke

## 2. Tech-Stack

### Frontend
- **React 19** + **Vite 8** (SPA, kein SSR)
- Styling: reines CSS (`App.css`, `index.css`) + Inline-Styles mit Farbkonstanten (`C`-Objekt in Matches.jsx)
- Icons: `lucide-react` + custom SVG-Komponenten (`AgapeCross`, `DoveIcon`)
- Karten: `leaflet` für interaktive Location-Auswahl im Date-Builder
- Geocoding: OpenStreetMap Nominatim API (reverse + search)
- Animation: `framer-motion` (importiert, aber sparsam genutzt)
- Routing: `react-router-dom` vorhanden in deps, aber **nicht aktiv** — Navigation über Tab-State in AppContext

### Backend / Datenbank
- **Supabase** (PostgreSQL + Auth + Storage)
- URL: `https://ksscosugtbdzgekrszck.supabase.co`
- Anon Key: hardcoded in `supabase.js` (publishable, kein Secret)

#### Tabellen
| Tabelle | Zweck |
|---|---|
| `profiles` | User-Profile (inkl. Stripe-Felder, Standort lat/lng, Fotos, Prompts) |
| `likes` | Likes mit Typ (photo/prompt/profile), Kommentar, Dove-Flag |
| `skips` | Übersprungene Profile |
| `matches` | Mutual Likes → Match (+ `nudge_at` für Deadline-Verlängerung) |
| `messages` | Chat-Nachrichten pro Match |
| `date_invitations` | Date-Einladungen mit Status-Flow (pending→responded→confirmed/declined) |

#### RLS-Policies
- Alle Tabellen haben RLS aktiviert
- Profiles: jeder kann aktive Profile lesen, nur eigenes bearbeiten
- Likes/Skips: nur eigene sehen/erstellen
- Matches/Messages: nur Teilnehmer des Matches

### Stripe (Zahlungen)
- **Supabase Edge Functions** für Checkout + Webhook (`stripe-checkout`, `stripe-webhook`)
- Edge Functions werden NICHT im Repo gepusht (lokaler `supabase/` Ordner, manuell deployed via `supabase functions deploy`)
- 3 Abo-Pläne: 1 Monat (CHF 14.99), 6 Monate (CHF 9.99/mo), 12 Monate (CHF 6.99/mo)
- Aktuell im **Test-Modus** (pk_test / sk_test Keys)

### Auth-Flow
- Supabase Auth (Email + Passwort)
- Registrierung: Multi-Step Onboarding (17 Schritte) → `supabase.auth.signUp` → Profile-Insert
- Login: `supabase.auth.signInWithPassword` → Profile laden
- Email-Bestätigung: **aktuell deaktiviert** (für Testing) — muss vor Launch aktiviert werden

### Legacy-Server (veraltet)
- `server/` Ordner enthält einen alten Express/MongoDB-Server — **wird nicht mehr verwendet**
- `render.yaml` referenziert ihn noch, ist aber irrelevant
- Das Frontend kommuniziert direkt mit Supabase

## 3. Projektstruktur

```
src/
├── main.jsx              # Entry Point
├── App.jsx               # Root: Onboarding oder Tab-Navigation
├── App.css / index.css   # Globale Styles
├── context/
│   └── AppContext.jsx     # Gesamter App-State (useReducer + Actions)
├── pages/
│   ├── Onboarding.jsx     # 17-Step Registrierung + Login
│   ├── Discover.jsx       # Swipe-Karten (Seek-Tab)
│   ├── LikesYou.jsx       # Eingehende Likes (Sparks-Tab)
│   ├── Standouts.jsx      # Hervorgehobene Profile (Chosen-Tab)
│   ├── Matches.jsx        # Chat + Date-System (Messages-Tab) — grösste Datei
│   └── Profile.jsx        # Eigenes Profil, Settings, Abo-Pläne
├── components/
│   ├── Navigation.jsx     # Bottom Tab Bar
│   ├── FilterSheet.jsx    # Alters-/Distanz-/Konfessions-Filter
│   ├── ReportSheet.jsx    # Report-Dialog
│   ├── LocationPicker.jsx # Nominatim-Autocomplete für Orte
│   ├── AgapeCross.jsx     # SVG Kreuz-Logo
│   ├── DoveIcon.jsx       # SVG Taube
│   └── WaveformBar.jsx    # Audio-Waveform Animation
├── services/
│   ├── supabase.js        # Supabase Client Init
│   ├── api.js             # Alle DB-Operationen (Auth, Discover, Likes, Matches, Messages, Dates)
│   └── stripe.js          # Stripe Checkout + Status
├── data/
│   └── profiles.js        # Prompt-Kategorien, Traits, Denominations (statische Daten)
└── utils/
    └── algorithm.js       # Kompatibilitäts-Score-Berechnung
```

## 4. Namenskonventionen

- **Dateien**: PascalCase für Komponenten (`FilterSheet.jsx`), camelCase für Services/Utils (`api.js`)
- **Komponenten**: PascalCase, eine Komponente pro Datei (Ausnahme: `Matches.jsx` enthält `DateBuilder`, `DateCard`, `MiniMap`, `ChatThread`)
- **Funktionen**: camelCase (`handleLikeBack`, `getDiscover`, `sendMessage`)
- **CSS-Klassen**: kebab-case (`like-card-photo`, `app-container`)
- **State-Actions**: UPPER_SNAKE_CASE (`SET_USER`, `MATCH_FROM_LIKES`)
- **DB-Spalten**: snake_case (`from_user`, `location_lat`, `date_type`)
- **JS-Properties**: camelCase, gemappt via `mapProfile()` und `mapProfileToUser()` in `api.js`

## 5. Bekannte Eigenheiten / wichtige Entscheidungen

- **Kein Router**: Navigation über `state.activeTab` im AppContext, nicht über URL-Routen
- **Alles in AppContext**: Gesamter State in einem einzigen `useReducer` — kein Redux, kein Zustand
- **api.js ist die zentrale Schnittstelle**: Alle Supabase-Aufrufe laufen über `api.js`, nie direkt aus Komponenten
- **Haversine client-seitig**: Distanzfilter berechnet Entfernungen im Frontend nach DB-Query (`haversineKm` in api.js)
- **Realtime + Polling**: Chat, Matches und Likes kommen per Supabase Realtime; Polling (5s Chat, 10s Listen) bleibt als Fallback und wird langsamer, sobald Live-Events ankommen
- **Matches.jsx ist überproportional gross**: Enthält den gesamten Chat, Date-Builder (3-Step), DateCard, MiniMap — Refactoring-Kandidat
- **Farbkonstanten**: `const C = { bg, card, surface, primary, primarySoft, text, sub, border, sent }` — in Matches.jsx inline definiert, in anderen Dateien via CSS
- **Supabase-URL und Anon-Key** sind hardcoded als Fallback in `supabase.js` (kein Secret, publishable)
- **Stripe Secret Key**: nur als Env-Var in Supabase Edge Functions, nie im Frontend
- **Seed-Script** (`seed-supabase.mjs`): braucht `SUPABASE_SERVICE_KEY` als Env-Var
- **5-Tage-Deadline + Rose**: Der Chat öffnet sofort nach dem Match. Nach der ersten echten Nachricht hat der Mann 5 Tage, um ein Date zu planen. Die Frau kann eine Rose senden (+36h); ein geplanter Videocall pausiert die Uhr bis 2h nach dem Call; eine abgesagte Planung gibt 5 neue Tage. Danach schliesst der Chat.

## 6. Aktueller Status

### Implementiert
- Onboarding (17-Step Registrierung mit Prompts, Traits, Foto-Upload, Location)
- Login / Logout
- Discover (Swipe-Karten mit Like/Skip/Dove/Kommentar)
- Sparks (eingehende Likes ansehen, matchen, ablehnen)
- Standouts (hervorgehobene Profile)
- Chat (Nachrichten senden/empfangen, 5s Polling)
- Date-Einladungssystem (3-Step: Typ → Ort mit Karte → Dresscode; sie wählt Zeiten, er bestätigt eine)
- Date-Response (Frau wählt Zeiten) + Confirm (Mann bestätigt)
- Date-Decline mit Gründen (Checkboxen)
- Rose (Frau → +36h Deadline)
- 5-Tage-Deadline mit Chat-Lock
- Distanzfilter (Haversine, server-seitig gefiltert)
- Alters-/Konfessions-Filter
- Profil bearbeiten (Name, Fotos, Prompts, Interests, Location)
- Report / Block / Unmatch
- Stripe Abo-Integration (3 Pläne, Checkout, Webhook)
- Kompatibilitäts-Algorithmus (`algorithm.js`)

### Unvollständig / Ausstehend
- **Stripe Live-Modus**: Aktuell Test-Keys — Live-Keys + Live-Produkte + Webhook-Secret nötig
- **Email-Bestätigung**: Deaktiviert für Testing — muss aktiviert werden
- **Supabase Realtime**: aktiv für messages/matches/likes/date_invitations (supabase/realtime.sql); Polling bleibt als Fallback
- **Foto-Upload**: Onboarding hat Upload-UI, aber Bilder gehen als Base64/Data-URL ins Array — kein Supabase Storage
- **Legacy-Server**: `server/` + `render.yaml` referenzieren alten Express/MongoDB-Stack — aufräumen
- **Stock-Bild für Onboarding-Welcome**: User möchte iStock-Bild einsetzen (noch nicht gekauft)
- **Seed-Daten entfernen**: Demo-Profile müssen vor Launch gelöscht werden
- **react-router-dom**: Dependency installiert aber nicht genutzt — entweder einbauen oder entfernen

### Test-Accounts
- Test-Logins (simon2@test.com, sarah@test.com, bg@test.com, Demo-Profile) existieren in Supabase; Passwörter stehen nicht im Repo (Repo ist öffentlich). Seed-Scripts lesen `SEED_PASSWORD` aus der Umgebung.

### Deployment
- **Frontend**: Render Static Site — auto-deploy von `master` Branch
- **URL**: https://agape-dating-app-frontend.onrender.com
- **GitHub**: https://github.com/simonlanker35-wq/agape-dating-app.git (Branch: `master`)
