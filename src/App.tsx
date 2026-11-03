import { useState, useMemo } from 'react';
import offlineEventsData from './data/offline-events.json';
import ratingsData from './data/ratings.json';

type ViewState = 'online' | 'offline';
type SortKey = 'name' | 'status' | 'leetcode' | 'codeforces' | 'codechef' | 'atcoder';
type SortOrder = 'asc' | 'desc';
type RatingValue = { username: string | null, rating: string | number | null, status: string };
type RatingKey = Exclude<SortKey, 'name' | 'status'>;
type RatingRow = typeof ratingsData[number];

const statusRank: Record<string, number> = {
  'Board Team Member': 0,
  'Senior Team': 1,
  'Junior Team': 2,
  Retired: 3,
};

function Navigation({ currentView, setView }: { currentView: ViewState, setView: (v: ViewState) => void }) {
  return (
    <nav className="nav-panel">
      <div className="nav-brand">
        <h1>IECSE</h1>
        <p>Official Competitive Programming Team</p>
      </div>
      <ul className="nav-links">
        <li>
          <button
            aria-current={currentView === 'online' ? 'page' : undefined}
            onClick={() => setView('online')}
          >
            Online Stats
          </button>
        </li>
        <li>
          <button
            aria-current={currentView === 'offline' ? 'page' : undefined}
            onClick={() => setView('offline')}
          >
            Offline Stats
          </button>
        </li>
      </ul>
    </nav>
  );
}

function RatingCell({ ratingObj, platformName }: { ratingObj: RatingValue, platformName: string }) {
  if (!ratingObj || !ratingObj.username || ratingObj.rating === null || ratingObj.rating === 'N/A' || ratingObj.status !== 'ok') {
    return <span className="na-text">N/A</span>;
  }

  let href = '';
  switch (platformName) {
    case 'LeetCode': href = `https://leetcode.com/u/${ratingObj.username}/`; break;
    case 'Codeforces': href = `https://codeforces.com/profile/${ratingObj.username}`; break;
    case 'CodeChef': href = `https://www.codechef.com/users/${ratingObj.username}`; break;
    case 'AtCoder': href = `https://atcoder.jp/users/${ratingObj.username}`; break;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${platformName} rating: ${ratingObj.rating}`}>
      {ratingObj.rating}
    </a>
  );
}

function OnlineStats() {
  const updatedAt = ratingsData.length > 0 && ratingsData[0].updatedAt ? new Date(ratingsData[0].updatedAt).toLocaleString() : 'Never';

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showRetired, setShowRetired] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder(key === 'status' ? 'asc' : 'desc');
    }
  };

  const sortedData = useMemo(() => {
    return ratingsData.filter((member) => showRetired || member.memberStatus !== 'Retired').sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortKey === 'status') {
        const cmp = statusRank[a.memberStatus] - statusRank[b.memberStatus];
        return cmp === 0 ? a.name.localeCompare(b.name) : (sortOrder === 'asc' ? cmp : -cmp);
      }

      // Extract numeric ratings or default to -Infinity for unrated so they fall to bottom when descending
      const getVal = (row: RatingRow, key: RatingKey) => {
        const r = row[key]?.rating;
        return (typeof r === 'number') ? r : -Infinity;
      };

      const valA = getVal(a, sortKey);
      const valB = getVal(b, sortKey);

      if (valA !== valB) {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // Tie-breaker: Name asc
      return a.name.localeCompare(b.name);
    });
  }, [sortKey, sortOrder, showRetired]);

  return (
    <main className="main-content">
      <header>
        <h2>Online Stats</h2>
        <div className="header-meta">
          <p>Ratings are refreshed daily from public profiles.</p>
          <div className="update-row">
            <p>Last updated: {updatedAt}</p>
            <label className="retired-toggle">
              <input type="checkbox" checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} />
              Show retired members
            </label>
          </div>
        </div>
      </header>

      <div className="table-wrapper">
        <table>
          <caption>Team member platform ratings</caption>
          <thead>
            <tr>
              <th className="col-name">
                <button onClick={() => handleSort('name')}>
                  Name {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="col-status">
                <button onClick={() => handleSort('status')}>
                  Status {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="col-rating">
                <button onClick={() => handleSort('leetcode')}>
                  LeetCode {sortKey === 'leetcode' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="col-rating">
                <button onClick={() => handleSort('codeforces')}>
                  Codeforces {sortKey === 'codeforces' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="col-rating">
                <button onClick={() => handleSort('codechef')}>
                  CodeChef {sortKey === 'codechef' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="col-rating">
                <button onClick={() => handleSort('atcoder')}>
                  AtCoder {sortKey === 'atcoder' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((member) => {
              const statusClass = member.memberStatus.toLowerCase().replace(/ /g, '-');
              return (
                <tr key={member.name}>
                  <td className="col-name">
                    {member.name === 'Roonil03' ? <span className="roonil-name">{member.name}</span> : member.name}
                  </td>
                  <td className="col-status">
                    <span className={`status-badge status-${statusClass}`}>{member.memberStatus}</span>
                  </td>
                  <td className="col-rating"><RatingCell ratingObj={member.leetcode} platformName="LeetCode" /></td>
                  <td className="col-rating"><RatingCell ratingObj={member.codeforces} platformName="Codeforces" /></td>
                  <td className="col-rating"><RatingCell ratingObj={member.codechef} platformName="CodeChef" /></td>
                  <td className="col-rating"><RatingCell ratingObj={member.atcoder} platformName="AtCoder" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function OfflineStats() {
  const sortedEvents = [...offlineEventsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <main className="main-content">
      <header>
        <h2>Offline Stats</h2>
        <div className="header-meta">
          <p>Historical competition and event achievements.</p>
        </div>
      </header>

      {sortedEvents.length === 0 ? (
        <p>No event records found.</p>
      ) : (
        <div className="event-list">
          {sortedEvents.map((ev, i) => (
            <article key={i} className="event-card">
              <div className="event-meta">
                <span>{new Date(ev.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <h3 className="event-title">{ev.event}</h3>
              <div className="event-position">{ev.position}</div>
              <p className="event-desc">{ev.eventDescription}</p>
              <div className="event-link">
                {ev.postUrl ? (
                  <a href={ev.postUrl} target="_blank" rel="noopener noreferrer">Read event post</a>
                ) : (
                  <span className="na-text">No post available</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function App() {
  const [view, setView] = useState<ViewState>('online');

  return (
    <div className="container">
      <Navigation currentView={view} setView={setView} />
      {view === 'online' ? <OnlineStats /> : <OfflineStats />}
    </div>
  );
}

export default App;
