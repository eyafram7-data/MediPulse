// Deletes data.json so the next start re-creates the demo data.
const fs = require('fs'), path = require('path');
const f = process.env.DATA_FILE || path.join(__dirname, '..', 'data.json');
if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('Removed', f, '- demo data will be re-created on next start.'); }
else console.log('Nothing to reset.');
