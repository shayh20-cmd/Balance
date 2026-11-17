import type { Device } from '../../data/repo';

const stamp = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** 2026-11-17T13:05:00Z → 17.11.2026 15:05 (Israel time) */
function lastSeen(iso: string): string {
  const p = Object.fromEntries(stamp.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${Number(p.day)}.${Number(p.month)}.${p.year} ${p.hour}:${p.minute}`;
}

export default function DeviceList({ devices, onRevoke, onShow }: {
  devices: Device[];
  onRevoke: (id: string) => void;
  onShow: (device: Device) => void;
}) {
  if (devices.length === 0) return <p className="muted">עוד לא חובר טלפון</p>;
  return (
    <>
      {devices.map((d) => (
        <div key={d.id} className="row">
          <span>
            <span>{d.name}</span>
            <div className="muted">{d.lastSeenAt ? `עסקה אחרונה: ${lastSeen(d.lastSeenAt)}` : 'עוד לא התקבלה עסקה'}</div>
          </span>
          <span className="actions-inline">
            <button type="button" onClick={() => onShow(d)}>הגדרות</button>
            <button type="button" className="danger" onClick={() => onRevoke(d.id)}>ניתוק</button>
          </span>
        </div>
      ))}
    </>
  );
}
