# Architecture

    Browser (public/index.html)  <--JSON over HTTP, polling every 3s-->  Node server (src/server.js)
                                                                          |-- auth: scrypt hashes, signed cookies
                                                                          |-- vitals simulator (swap for real devices later)
                                                                          |-- alert rules
                                                                          |-- JSON file store (data.json)
                                                                          '-- Zoom API (Server-to-Server OAuth)

The simulator writes one reading per patient every 3 seconds. To use real devices later, replace `tick()` with a source that ingests readings from Health Connect, HealthKit or BLE sensors; the rest of the app is unchanged.

## Future work
Real database, email verification, push notifications (Capacitor), clinician role, device integration, HTTPS deployment.
