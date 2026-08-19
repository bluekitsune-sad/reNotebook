'use client';

import { useState, useEffect, useCallback } from 'react';

function useCountdown(expiry) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiry - Date.now()));

  useEffect(() => {
    if (!expiry) return;
    const tick = () => setRemaining(Math.max(0, expiry - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiry]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const expired = remaining <= 0;

  return { minutes, seconds, expired, totalSeconds };
}

function QRPlaceholder({ url }) {
  return (
    <div className="qr-visual">
      <div className="qr-grid">
        {Array.from({ length: 11 }).map((_, row) => (
          <div key={row} className="qr-row">
            {Array.from({ length: 11 }).map((_, col) => {
              const isCorner = (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3);
              const isFilled = isCorner || ((row * 7 + col * 13 + row * col) % 3 === 0);
              return (
                <div
                  key={col}
                  className={`qr-cell ${isFilled ? 'qr-cell--filled' : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QRCode({ url, verificationCode, expiry, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const { minutes, seconds, expired, totalSeconds } = useCountdown(expiry);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url]);

  const timerPercent = Math.max(0, (totalSeconds / 300) * 100);

  return (
    <div className={`qr-pairing-area ${expired ? 'qr-pairing-area--expired' : ''}`}>
      <div className="qr-pairing-header">
        <h2>Add New Device</h2>
        <p>Scan this code or enter the pairing URL on your new device</p>
      </div>

      <div className="qr-pairing-body">
        <div className="qr-visual-wrapper">
          <QRPlaceholder url={url} />
          {expired && (
            <div className="qr-expired-overlay">
              <span>QR Expired</span>
            </div>
          )}
        </div>

        {verificationCode && (
          <div className="qr-verification">
            <span className="qr-verification-label">Verification Code</span>
            <span className="qr-verification-code">{verificationCode}</span>
          </div>
        )}

        <div className="qr-countdown">
          <div className="qr-countdown-bar">
            <div
              className="qr-countdown-fill"
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          <span className={`qr-countdown-text ${expired ? 'qr-countdown-text--expired' : ''}`}>
            {expired ? 'Expired' : `${minutes}:${String(seconds).padStart(2, '0')} remaining`}
          </span>
        </div>

        <div className="qr-url-row">
          <code className="qr-url-text">{url}</code>
          <button className="btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="qr-pairing-actions">
          <button className="btn-ghost btn-sm" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
