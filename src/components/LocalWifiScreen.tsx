import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Share2,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { RoomPresence } from '../types';
import type { SyncConnectionStatus } from '../hooks/useRoomSync';

interface LocalWifiScreenProps {
  roomId: string;
  presence: RoomPresence;
  syncStatus: SyncConnectionStatus;
  rttMs: number | null;
  onChangeRoomId: (roomId: string) => void;
  onPreviewMemberApp: () => void;
  onBack: () => void;
}

interface NetworkAddress {
  name: string;
  address: string;
}

export const LocalWifiScreen: React.FC<LocalWifiScreenProps> = ({
  roomId,
  presence,
  syncStatus,
  rttMs,
  onChangeRoomId,
  onPreviewMemberApp,
  onBack,
}) => {
  const [networkInfo, setNetworkInfo] = useState<{
    port: number;
    addresses: NetworkAddress[];
  }>({ port: 3000, addresses: [] });
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedHost(window.location.origin);
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data: { port: number; addresses: NetworkAddress[] }) => {
        setNetworkInfo(data);
        // If running on localhost and a LAN IP (like hotspot 192.168.x.x) exists, offer it prominently
        if (
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
          data.addresses.length > 0
        ) {
          setSelectedHost(`http://${data.addresses[0].address}:${data.port}`);
        }
      })
      .catch(() => {});
  }, []);

  const memberUrl = `${selectedHost || window.location.origin}/?mode=member&room=${encodeURIComponent(
    roomId
  )}`;

  useEffect(() => {
    QRCode.toDataURL(memberUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#121212',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [memberUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(memberUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked
    }
  };

  const handleShareSimpleApp = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Chordbook Stage — Band Member App',
          text: `Join live band sync (Room ${roomId}) over local Wi-Fi:`,
          url: memberUrl,
        });
        return;
      } catch {
        // User cancelled or fallback to copy
      }
    }
    await handleCopyLink();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Your sheets"
          className="w-10 h-10 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium shadow-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-[#E5A958]'
            }`}
          />
          <span className="text-[var(--text-primary)] tabular-nums">
            {syncStatus === 'connected'
              ? `Sync Hub Ready${rttMs !== null ? ` · ${rttMs}ms` : ''}`
              : 'Connecting sync hub...'}
          </span>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-medium tracking-[0.24em] text-[var(--text-muted)] uppercase">
          LOCAL WI-FI &amp; HOTSPOT SYNC
        </p>
        <h1 className="font-serif-display text-[32px] leading-[1.1] font-bold text-[var(--text-primary)] mt-1">
          Simple Band Member App
        </h1>
        <p className="text-[14px] text-[var(--text-muted)] mt-1.5">
          Share a stripped-down, read-only stage view to your bandmates over a Mobile Hotspot with instant bar &amp; key sync.
        </p>
      </div>

      {/* Step-by-step Hotspot Guide */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-5 space-y-3 shadow-xs">
        <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--accent-amber-text)] uppercase">
          MOBILE HOTSPOT GUIDE
        </p>
        <ol className="space-y-2.5 text-[14px] text-[var(--text-primary)]">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/50 text-[var(--accent-amber-text)] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span>Turn on your Mobile Hotspot.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/50 text-[var(--accent-amber-text)] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span>Band members connect to your Wi-Fi.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/50 text-[var(--accent-amber-text)] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span>Scan the QR code or tap &lsquo;Share / Send Simple App&rsquo; below.</span>
          </li>
        </ol>
      </div>

      {/* QR Code & Link Share Card */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-5 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center shadow-xs">
        <div className="flex flex-col items-center">
          <div className="p-3 rounded-2xl bg-white border border-[var(--border-subtle)] shadow-md">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for Room ${roomId}`}
                className="w-44 h-44 block"
              />
            ) : (
              <div className="w-44 h-44 bg-[var(--border-subtle)] animate-pulse rounded-xl" />
            )}
          </div>
          <span className="text-[11px] tracking-[0.2em] text-[var(--text-muted)] uppercase mt-2.5 tabular-nums">
            ROOM {roomId}
          </span>
        </div>

        <div className="space-y-4 min-w-0">
          {/* Room Code & Host Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase mb-1.5">
                Room Code
              </label>
              <input
                type="text"
                maxLength={8}
                value={roomId}
                onChange={(e) => onChangeRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="w-full h-10 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm font-semibold tracking-widest text-[var(--accent-amber-text)] tabular-nums focus:border-[#E5A958] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase mb-1.5">
                Network Address
              </label>
              <select
                value={selectedHost}
                onChange={(e) => setSelectedHost(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none"
              >
                <option value={window.location.origin}>
                  Current URL ({window.location.host})
                </option>
                {networkInfo.addresses.map((addr) => {
                  const hostUrl = `http://${addr.address}:${networkInfo.port}`;
                  return (
                    <option key={addr.address} value={hostUrl}>
                      Hotspot / Wi-Fi ({addr.address}:{networkInfo.port})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Copyable Direct Member URL */}
          <div>
            <label className="block text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase mb-1.5">
              Band Member Direct Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-10 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] flex items-center text-xs text-[var(--text-muted)] truncate select-all">
                {memberUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy member link"
                className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleShareSimpleApp}
              className="flex-1 h-11 px-4 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <Share2 className="w-4 h-4" />
              <span>{copied ? 'Link Copied!' : 'Share / Send Simple App'}</span>
            </button>

            <button
              type="button"
              onClick={onPreviewMemberApp}
              className="flex-1 h-11 px-4 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[#E5A958]/50 text-[var(--accent-amber-text)] font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Member App</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connected Members List */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--accent-amber-text)]" />
            <h2 className="font-serif-display text-lg font-bold text-[var(--text-primary)]">
              Connected Band Members
            </h2>
          </div>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {presence.memberCount} online
          </span>
        </div>

        {presence.members.filter((m) => m.role === 'member').length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-4 flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <Wifi className="w-4 h-4 text-[var(--text-subtle)] shrink-0" />
            <span>
              No band members connected yet. Have them scan the QR code or open the link above on their phone.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {presence.members
              .filter((m) => m.role === 'member')
              .map((member, idx) => (
                <div
                  key={member.clientId}
                  className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-[var(--accent-amber-text)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {member.deviceName || `Band Member ${idx + 1}`}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">Read-only Chordbook Stage</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-500">Synced</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
