'use client';

import { useState } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function dateKey(dateStr) {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function eventIcon(type) {
  switch (type) {
    case 'created': return '\u2795';
    case 'updated': return '\u270F\uFE0F';
    case 'deleted': return '\u274C';
    case 'restored': return '\u21A9\uFE0F';
    case 'renamed': return '\u270D\uFE0F';
    case 'visibility_changed': return '\uD83D\uDD12';
    case 'device_paired': return '\uD83D\uDCF1';
    case 'device_revoked': return '\uD83D\uDD11';
    default: return '\u2022';
  }
}

function eventLabel(type) {
  switch (type) {
    case 'created': return 'Created';
    case 'updated': return 'Updated';
    case 'deleted': return 'Deleted';
    case 'restored': return 'Restored';
    case 'renamed': return 'Renamed';
    case 'visibility_changed': return 'Visibility changed';
    case 'device_paired': return 'Device paired';
    case 'device_revoked': return 'Device revoked';
    default: return type || 'Unknown';
  }
}

function DiffView({ before, after }) {
  if (!before && !after) return null;
  return (
    <div className="history-diff">
      {before && (
        <div className="history-diff-block history-diff-block--before">
          <span className="history-diff-label">Before</span>
          <pre className="history-diff-content">{typeof before === 'string' ? before : JSON.stringify(before, null, 2)}</pre>
        </div>
      )}
      {after && (
        <div className="history-diff-block history-diff-block--after">
          <span className="history-diff-label">After</span>
          <pre className="history-diff-content">{typeof after === 'string' ? after : JSON.stringify(after, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function AuditEvent({ event }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = event.before || event.after || event.details;

  return (
    <div className="history-event">
      <div className="history-event-main">
        <span className="history-event-icon">{eventIcon(event.type)}</span>
        <div className="history-event-details">
          <div className="history-event-summary">
            <span className="history-event-action">{eventLabel(event.type)}</span>
            {event.noteTitle && (
              <span className="history-event-note">&ldquo;{event.noteTitle}&rdquo;</span>
            )}
          </div>
          <div className="history-event-meta">
            {event.deviceName && (
              <span className="history-event-device">{event.deviceName}</span>
            )}
            <span className="history-event-time">{timeAgo(event.timestamp || event.createdAt)}</span>
          </div>
        </div>
        {hasDetails && (
          <button
            className="btn-ghost btn-sm history-expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '\u25B2' : '\u25BC'}
          </button>
        )}
      </div>
      {expanded && hasDetails && (
        <DiffView before={event.before} after={event.after} />
      )}
    </div>
  );
}

export default function HistoryList({ events }) {
  const grouped = {};
  events.forEach((event) => {
    const key = dateKey(event.timestamp || event.createdAt);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(event);
  });

  return (
    <div className="history-list">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="history-group">
          <h3 className="history-date-header">{date}</h3>
          <div className="history-group-events">
            {items.map((event, i) => (
              <AuditEvent key={event.id || i} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
