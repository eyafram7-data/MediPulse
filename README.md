# MediPulse

Remote care app for patients with mobility issues. Patients and caregivers sign up, each gets their own dashboard with live vitals, trends, alerts and medication tracking, and either can start a Zoom call.

Final year project. Vitals are simulated; real device integration is future work (see `docs/ARCHITECTURE.md`).

## Quick start
Requires Node.js 18+. No dependencies to install.

    git clone <your-repo-url>
    cd medipulse
    npm start

Open http://localhost:3000.

## Scripts
| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with auto-restart on file changes |
| `npm test` | Run the API tests (takes about 10 seconds) |
| `npm run reset` | Delete `data.json` to restore the demo data |

## Demo accounts (password: `demo1234`)
- Akosua Boateng, patient: `akosua@demo.gh` (care code `AKO-482`)
- Kwame Asante, patient: `kwame@demo.gh` (care code `KWA-731`)
- Yaw Boateng, caregiver of Akosua: `yaw@demo.gh`

Sign up as a patient to get a care code. Sign up as a caregiver using a patient's code.

## Zoom
Without credentials the call button opens Zoom's test page (demo mode). For real meetings, create a Server-to-Server OAuth app at marketplace.zoom.us with the meeting write scope, copy `.env.example` to `.env`, fill it in, and run:

    node --env-file=.env src/server.js

Never commit `.env` (it is in `.gitignore`).

## Project layout
    src/server.js      backend: auth, simulator, alerts, Zoom
    public/index.html  patient and caregiver dashboards
    scripts/           helper scripts
    test/              API tests (node:test)
    docs/              API and architecture notes

## Security note
Prototype only. Passwords are hashed with scrypt and sessions use signed HttpOnly cookies, but data is stored in a JSON file and there is no email verification. Use HTTPS and a real database, and follow data protection law (for example Ghana's Data Protection Act 2012), before handling real patient data.

## License
MIT
