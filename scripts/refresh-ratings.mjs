import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MEMBERS_FILE = path.resolve('src', 'data', 'members.json');
const RATINGS_FILE = path.resolve('src', 'data', 'ratings.json');
const ALLOWED_STATUSES = ['Junior Team', 'Senior Team', 'Retired', 'Board Team Member'];
const RETRIES = 3;
const REQUEST_TIMEOUT_MS = 10000;

const LEETCODE_QUERY = `query userContestRating($username: String!) {
  matchedUser(username: $username) { username }
  userContestRanking(username: $username) { rating }
}`;

function ratingResult(status, username, rating = null) {
  return { status, rating, username };
}

function parseRating(value, source) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`${source} returned an empty rating`);
  }
  const numeric = typeof value === 'number' ? value : Number(String(value).replaceAll(',', '').trim());
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${source} returned an invalid rating`);
  }
  return numeric;
}

function responseError(response) {
  if (response.status === 404) return Object.assign(new Error('Profile not found'), { notFound: true });
  return Object.assign(new Error(`HTTP ${response.status}`), {
    retryable: response.status === 429 || response.status >= 500,
  });
}

async function fetchResponse(url, options = {}, fetchImpl = globalThis.fetch) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (response.status === 404) throw responseError(response);
      if (!response.ok) throw responseError(response);
      return response;
    } catch (error) {
      if (error?.notFound || error?.retryable === false) throw error;
      lastError = error;
      if (attempt < RETRIES - 1) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('Request failed');
}

async function fetchJson(url, options, fetchImpl) {
  const response = await fetchResponse(url, options, fetchImpl);
  return response.json();
}

function htmlText(fragment) {
  return fragment
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

export function parseCodeChefRating(html) {
  const match = html.match(/class=["'][^"']*\brating-number\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|strong|p)>/i);
  if (!match) {
    if (/<title[^>]*>[^<]*CodeChef User Profile[^<]*<\/title>/i.test(html)) return null;
    throw new Error('CodeChef profile did not contain a rating-number element');
  }
  const text = htmlText(match[1]);
  if (!text || /^(?:not\s+rated|unrated|n\/a|-)$/i.test(text)) return null;
  const numberText = text.match(/^([\d,]+)(?:\?|\b)/)?.[1];
  const numeric = Number(numberText?.replaceAll(',', ''));
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('CodeChef profile contained an invalid rating');
  return numeric;
}

export function parseAtCoderRating(history) {
  if (!Array.isArray(history)) throw new Error('AtCoder returned an unexpected rating-history response');
  const lastRated = [...history].reverse().find(item => item?.IsRated === true);
  if (!lastRated) return null;
  return parseRating(lastRated.NewRating, 'AtCoder');
}

export async function fetchCodeforcesRatings(usernames, fetchImpl = globalThis.fetch) {
  const handles = [...new Set(usernames.filter(Boolean))];
  if (handles.length === 0) return new Map();

  const url = new URL('https://codeforces.com/api/user.info');
  url.searchParams.set('handles', handles.join(';'));
  let payload;
  try {
    payload = await fetchJson(url, { headers: { accept: 'application/json' } }, fetchImpl);
  } catch (error) {
    if (error?.notFound) return new Map(handles.map(handle => [handle, ratingResult('not-found', handle)]));
    return new Map(handles.map(handle => [handle, ratingResult('error', handle)]));
  }

  if (payload?.status !== 'OK' || !Array.isArray(payload.result)) {
    const result = new Map(handles.map(handle => [handle, ratingResult('error', handle)]));
    return result;
  }
  if (payload.result.length !== handles.length) {
    return new Map(handles.map(handle => [handle, ratingResult('error', handle)]));
  }
  return new Map(handles.map((handle, index) => {
    const user = payload.result[index];
    if (!user) return [handle, ratingResult('not-found', handle)];
    try {
      const rating = user.rating === undefined ? null : parseRating(user.rating, 'Codeforces');
      return [handle, ratingResult('ok', handle, rating)];
    } catch {
      return [handle, ratingResult('error', handle)];
    }
  }));
}

export async function fetchLeetCode(username, fetchImpl = globalThis.fetch) {
  const body = {
    query: LEETCODE_QUERY,
    variables: { username },
  };
  let payload;
  try {
    payload = await fetchJson('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    }, fetchImpl);
  } catch (error) {
    return ratingResult(error?.notFound ? 'not-found' : 'error', username);
  }
  if (!payload || !payload.data || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
    return ratingResult('error', username);
  }
  if (!Object.hasOwn(payload.data, 'matchedUser') || !Object.hasOwn(payload.data, 'userContestRanking')) {
    return ratingResult('error', username);
  }
  if (!payload.data.matchedUser) return ratingResult('not-found', username);
  try {
    const rating = payload.data.userContestRanking?.rating;
    return ratingResult('ok', username, rating == null ? null : Math.round(parseRating(rating, 'LeetCode')));
  } catch {
    return ratingResult('error', username);
  }
}

export async function fetchCodeChef(username, fetchImpl = globalThis.fetch) {
  let html;
  try {
    const response = await fetchResponse(`https://www.codechef.com/users/${encodeURIComponent(username)}`, {
      headers: { accept: 'text/html' },
    }, fetchImpl);
    html = await response.text();
  } catch (error) {
    return ratingResult(error?.notFound ? 'not-found' : 'error', username);
  }
  if (/<title[^>]*>\s*CodeChef - Learn and Practice Coding with Problems/i.test(html)) {
    return ratingResult('not-found', username);
  }
  try {
    return ratingResult('ok', username, parseCodeChefRating(html));
  } catch {
    return ratingResult('error', username);
  }
}

export async function fetchAtCoder(username, fetchImpl = globalThis.fetch) {
  const url = `https://atcoder.jp/users/${encodeURIComponent(username)}/history/json`;
  let history;
  try {
    history = await fetchJson(url, { headers: { accept: 'application/json' } }, fetchImpl);
  } catch (error) {
    return ratingResult(error?.notFound ? 'not-found' : 'error', username);
  }
  try {
    return ratingResult('ok', username, parseAtCoderRating(history));
  } catch {
    return ratingResult('error', username);
  }
}

export function resolvePlatform(current, oldPlatform) {
  if (current.status !== 'error' || !oldPlatform || oldPlatform.status !== 'ok') return current;
  const oldRating = oldPlatform.rating;
  const oldUsername = oldPlatform.username;
  const sameAccount = (current.username ?? null) === (oldUsername ?? null);
  const hasUsableOldRating = oldRating !== null && oldRating !== undefined && String(oldRating).trim() !== '' &&
    Number.isFinite(Number(String(oldRating).replaceAll(',', '').trim()));
  if (!sameAccount || !hasUsableOldRating) return current;
  return { ...current, status: 'ok', rating: oldRating, _transientError: true };
}

export async function refreshRatings({ members, oldRatings = [], fetchImpl = globalThis.fetch, log = console.log }) {
  const oldRatingsMap = new Map(oldRatings.map(row => [row.name, row]));
  const codeforces = await fetchCodeforcesRatings(members.map(member => member.codeforcesUsername), fetchImpl);
  const results = [];
  const now = new Date().toISOString();

  for (const member of members) {
    if (!ALLOWED_STATUSES.includes(member.memberStatus)) {
      throw new Error(`Invalid memberStatus for ${member.name}: ${member.memberStatus}. Must be one of ${ALLOWED_STATUSES.join(', ')}`);
    }
    log(`Fetching stats for ${member.name}...`);
    const [leetcode, codechef, atcoder] = await Promise.all([
      member.leetcodeUsername ? fetchLeetCode(member.leetcodeUsername, fetchImpl) : Promise.resolve(ratingResult('ok', null)),
      member.codechefUsername ? fetchCodeChef(member.codechefUsername, fetchImpl) : Promise.resolve(ratingResult('ok', null)),
      member.atcoderUsername ? fetchAtCoder(member.atcoderUsername, fetchImpl) : Promise.resolve(ratingResult('ok', null)),
    ]);
    const codeforcesResult = member.codeforcesUsername
      ? codeforces.get(member.codeforcesUsername) ?? ratingResult('error', member.codeforcesUsername)
      : ratingResult('ok', null);
    const old = oldRatingsMap.get(member.name);
    const resolve = (current, oldPlatform) => {
      const finalResult = resolvePlatform(current, oldPlatform);
      if (finalResult._transientError) log(`  Warning: Failed to fetch for ${current.username}, using previous successful rating.`);
      return finalResult;
    };
    results.push({
      name: member.name,
      memberStatus: member.memberStatus,
      leetcode: resolve(leetcode, old?.leetcode),
      codeforces: resolve(codeforcesResult, old?.codeforces),
      codechef: resolve(codechef, old?.codechef),
      atcoder: resolve(atcoder, old?.atcoder),
      updatedAt: now,
    });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  if (!fs.existsSync(MEMBERS_FILE)) throw new Error('members.json not found!');
  const members = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
  const oldRatings = fs.existsSync(RATINGS_FILE) ? JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf8')) : [];
  const results = await refreshRatings({ members, oldRatings });
  fs.writeFileSync(RATINGS_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log('Done writing ratings.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  });
}
