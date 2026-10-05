# API

All endpoints are JSON. Auth uses a signed HttpOnly `sid` cookie set by sign-up or login.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /api/signup | public | `{name,email,password,role,code?}`; role is `patient` or `caregiver`; caregivers need a patient's care code |
| POST | /api/login | public | `{email,password}`; locked for 5 minutes after 5 failures |
| POST | /api/logout | any | clears the session |
| GET | /api/dashboard | any | patient: own data incl. care code. caregiver: linked patients |
| POST | /api/meds | patient | `{id}` toggles a medication as taken |
| POST | /api/scenario | patient | `{scn}` demo: normal, hypoxia, fever, tachycardia |
| POST | /api/ack | linked users | `{pid,id}` acknowledges an alert |
| POST | /api/call | linked users | `{pid}` creates or reuses a Zoom call (valid 1 hour) |

## Alert rules
Normal / warning / critical ranges per vital are in `lvl()` in `src/server.js`. An alert fires after 2 consecutive abnormal readings and clears when readings return to normal.
