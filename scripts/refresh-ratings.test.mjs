import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCodeforcesRatings,
  fetchCodeChef,
  fetchLeetCode,
  parseAtCoderRating,
  parseCodeChefRating,
  refreshRatings,
  resolvePlatform,
} from './refresh-ratings.mjs';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('CodeChef missing profile page is not mistaken for an API outage', async () => {
  const fetchImpl = async () => new Response('<title>CodeChef - Learn and Practice Coding with Problems</title>');
  assert.deepEqual(await fetchCodeChef('missing', fetchImpl), {
    status: 'not-found', username: 'missing', rating: null,
  });
});

test('CodeChef parser reads numeric ratings and recognizes an unrated account', () => {
  assert.equal(parseCodeChefRating('<div class="rating-number">1,234</div>'), 1234);
  assert.equal(parseCodeChefRating('<div class="rating-number">961?<a class="rating-tooltip">help</a></div>'), 961);
  assert.equal(parseCodeChefRating('<div class="rating-number">Not Rated</div>'), null);
  assert.equal(parseCodeChefRating('<title>beetroot21 | CodeChef User Profile for Dhruv | CodeChef</title>'), null);
  assert.throws(() => parseCodeChefRating('<main>Profile layout changed</main>'), /rating-number/);
});

test('AtCoder parser selects the most recent rated contest', () => {
  assert.equal(parseAtCoderRating([
    { IsRated: true, NewRating: 1111 },
    { IsRated: false, NewRating: -1 },
  ]), 1111);
  assert.equal(parseAtCoderRating([{ IsRated: false, NewRating: -1 }]), null);
  assert.throws(() => parseAtCoderRating({}), /unexpected/);
});

test('transient fallback preserves data only for the same configured username', () => {
  const old = { status: 'ok', username: 'old-handle', rating: '900' };
  assert.deepEqual(resolvePlatform({ status: 'error', username: 'old-handle', rating: null }, old), {
    status: 'ok', username: 'old-handle', rating: '900', _transientError: true,
  });
  assert.deepEqual(resolvePlatform({ status: 'error', username: 'new-handle', rating: null }, old), {
    status: 'error', username: 'new-handle', rating: null,
  });
  assert.equal(resolvePlatform({ status: 'error', username: 'x', rating: null }, {
    status: 'ok', username: 'x', rating: '  ',
  }).rating, null);
});

test('Codeforces official API batch preserves zero rating and aliases', async () => {
  const fetchImpl = async () => jsonResponse({
    status: 'OK',
    result: [{ handle: 'NewName', rating: 0 }, { handle: 'Unrated' }],
  });
  const results = await fetchCodeforcesRatings(['OldName', 'Unrated'], fetchImpl);
  assert.deepEqual(results.get('OldName'), { status: 'ok', username: 'OldName', rating: 0 });
  assert.deepEqual(results.get('Unrated'), { status: 'ok', username: 'Unrated', rating: null });
});

test('LeetCode GraphQL response distinguishes a rating from a valid unrated profile', async () => {
  const responses = [
    { data: { matchedUser: { username: 'rated' }, userContestRanking: { rating: 1842.5 } } },
    { data: { matchedUser: { username: 'unrated' }, userContestRanking: null } },
    { data: { matchedUser: null, userContestRanking: null } },
    { data: { matchedUser: { username: 'partial' }, userContestRanking: null }, errors: [{ message: 'upstream field error' }] },
  ];
  const fetchImpl = async () => jsonResponse(responses.shift());
  assert.deepEqual(await fetchLeetCode('rated', fetchImpl), { status: 'ok', username: 'rated', rating: 1843 });
  assert.deepEqual(await fetchLeetCode('unrated', fetchImpl), { status: 'ok', username: 'unrated', rating: null });
  assert.deepEqual(await fetchLeetCode('missing', fetchImpl), { status: 'not-found', username: 'missing', rating: null });
  assert.deepEqual(await fetchLeetCode('partial', fetchImpl), { status: 'error', username: 'partial', rating: null });
});

test('blank LeetCode rating is rejected instead of replacing a saved value', async () => {
  const response = { data: { matchedUser: { username: 'rated' }, userContestRanking: { rating: '  ' } } };
  assert.deepEqual(await fetchLeetCode('rated', async () => jsonResponse(response)), {
    status: 'error', username: 'rated', rating: null,
  });
});

test('unexpected successful payload is an error and does not discard previous rating', async () => {
  const members = [{
    name: 'Member', memberStatus: 'Senior Team',
    leetcodeUsername: 'new-handle', codeforcesUsername: 'cf', codechefUsername: null, atcoderUsername: null,
  }];
  const oldRatings = [{
    name: 'Member',
    leetcode: { status: 'ok', username: 'old-handle', rating: 1700 },
    codeforces: { status: 'ok', username: 'cf', rating: 1200 },
  }];
  const fetchImpl = async url => {
    if (String(url).includes('codeforces.com')) return jsonResponse({ status: 'OK', result: [{ handle: 'cf', rating: 0 }] });
    if (String(url).includes('leetcode.com')) return jsonResponse({ data: { matchedUser: { username: 'new-handle' }, userContestRanking: { rating: 'not-a-number' } } });
    throw new Error(`Unexpected URL ${url}`);
  };
  const results = await refreshRatings({ members, oldRatings, fetchImpl, log: () => {} });
  assert.deepEqual(results[0].leetcode, { status: 'error', username: 'new-handle', rating: null });
  assert.deepEqual(results[0].codeforces, { status: 'ok', username: 'cf', rating: 0 });
});
