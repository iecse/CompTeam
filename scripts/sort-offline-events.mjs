import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'offline-events.json');

function dateValue(date, index) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Event at index ${index} must have an ISO date in YYYY-MM-DD format`);
  }

  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error(`Event at index ${index} has an invalid ISO date: ${date}`);
  }
  return timestamp;
}

export function sortOfflineEvents(events) {
  if (!Array.isArray(events)) throw new Error('offline-events.json must be an array');

  return events
    .map((event, index) => ({ event, index, timestamp: dateValue(event?.date, index) }))
    .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index)
    .map(({ event }) => event);
}

export function isSortedNewestFirst(events) {
  const sorted = sortOfflineEvents(events);
  return events.every((event, index) => event === sorted[index]);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const unexpectedArgs = process.argv.slice(2).filter(arg => arg !== '--check');
  if (unexpectedArgs.length) throw new Error(`Unknown argument: ${unexpectedArgs[0]}`);

  const source = fs.readFileSync(EVENTS_PATH, 'utf8');
  const events = JSON.parse(source);
  const sorted = sortOfflineEvents(events);

  if (checkOnly) {
    if (!isSortedNewestFirst(events)) {
      console.error('offline-events.json is not sorted newest to oldest; run npm run sort:offline-events');
      process.exitCode = 1;
      return;
    }
    console.log('offline-events.json is sorted newest to oldest');
    return;
  }

  fs.writeFileSync(EVENTS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log('Sorted offline-events.json newest to oldest');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error('Could not sort offline-events.json:', error.message);
    process.exitCode = 1;
  }
}
