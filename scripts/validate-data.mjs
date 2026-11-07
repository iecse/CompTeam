import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const membersPath = path.join(ROOT_DIR, 'src', 'data', 'members.json');
const offlinePath = path.join(ROOT_DIR, 'src', 'data', 'offline-events.json');

const ALLOWED_STATUSES = ['Junior Team', 'Senior Team', 'Retired', 'Board Team Member'];

function validateMembers() {
  if (!fs.existsSync(membersPath)) {
    console.error(`Missing ${membersPath}`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
  if (!Array.isArray(data)) {
    console.error('members.json must be an array');
    process.exit(1);
  }
  
  const names = new Set();
  
  for (const m of data) {
    if (!m.name) {
      console.error('Member missing name');
      process.exit(1);
    }
    if (names.has(m.name)) {
      console.error(`Duplicate member name: ${m.name}`);
      process.exit(1);
    }
    names.add(m.name);
    
    if (!ALLOWED_STATUSES.includes(m.memberStatus)) {
      console.error(`Invalid memberStatus "${m.memberStatus}" for ${m.name}`);
      process.exit(1);
    }
  }
  console.log('members.json is valid');
}

function validateOfflineEvents() {
  if (!fs.existsSync(offlinePath)) {
    console.error(`Missing ${offlinePath}`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(offlinePath, 'utf8'));
  if (!Array.isArray(data)) {
    console.error('offline-events.json must be an array');
    process.exit(1);
  }
  
  for (const e of data) {
    if (!e.date || !e.event || !e.position || !e.eventDescription || typeof e.location !== 'string' || !e.location.trim()) {
      console.error(`Invalid event record: ${JSON.stringify(e)}`);
      process.exit(1);
    }
    if (isNaN(new Date(e.date).getTime())) {
      console.error(`Invalid date format for event: ${e.event}`);
      process.exit(1);
    }
  }
  console.log('offline-events.json is valid');
}

try {
  validateMembers();
  validateOfflineEvents();
} catch(err) {
  console.error('Validation failed', err);
  process.exit(1);
}
