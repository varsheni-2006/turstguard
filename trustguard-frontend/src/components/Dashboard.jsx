import './Dashboard.css';

const STATS = [
  {
    key: 'docs',
    label: 'Documents',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    color: 'blue',
  },
  {
    key: 'queries',
    label: 'Queries Run',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    color: 'purple',
  },
  {
    key: 'conflicts',
    label: 'Conflicts Found',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    color: 'orange',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    color: 'green',
  },
];

function Dashboard({ stats }) {
  return (
    <div className="dashboard">
      {STATS.map(s => (
        <div key={s.key} className={`stat-card stat-card--${s.color}`}>
          <div className={`stat-icon stat-icon--${s.color}`}>{s.icon}</div>
          <div className="stat-body">
            <div className="stat-value">{stats[s.key] ?? 0}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Dashboard;
