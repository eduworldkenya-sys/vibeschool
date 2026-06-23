import { TeacherAlert } from "@/lib/types";

const TYPE_STYLES: Record<string, { background: string; border: string; color: string }> = {
  urgent:  { background: 'rgba(255,77,106,0.10)',  border: '1px solid rgba(255,77,106,0.30)',  color: '#FF4D6A' },
  warning: { background: 'rgba(255,184,0,0.10)',   border: '1px solid rgba(255,184,0,0.30)',   color: '#FFB800' },
  info:    { background: 'rgba(0,184,255,0.10)',   border: '1px solid rgba(0,184,255,0.30)',   color: '#00B8FF' },
  success: { background: 'rgba(0,229,160,0.10)',   border: '1px solid rgba(0,229,160,0.30)',   color: '#00E5A0' },
};

const TYPE_ICONS: Record<string, string> = {
  urgent:  '⚠',
  warning: '◈',
  info:    '◎',
  success: '✓',
};

interface Props {
  alerts: TeacherAlert[];
}

export default function AlertBanner({ alerts }: Props) {
  if (!alerts.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map((alert) => {
        const s = TYPE_STYLES[alert.type] ?? TYPE_STYLES.info;
        return (
          <div
            key={alert.id}
            style={{
              display:     'flex',
              alignItems:  'flex-start',
              gap:         12,
              padding:     '12px 16px',
              borderRadius: 12,
              border:      s.border,
              background:  s.background,
              color:       s.color,
              fontSize:    14,
            }}
          >
            <span style={{ flexShrink: 0, fontWeight: 700 }}>
              {TYPE_ICONS[alert.type]}
            </span>
            <span style={{ flex: 1 }}>{alert.message}</span>
            {alert.action && alert.actionHref && (
              <a
                href={alert.actionHref}
                style={{
                  flexShrink:     0,
                  color:          'inherit',
                  fontSize:       12,
                  fontWeight:     600,
                  textDecoration: 'underline',
                  opacity:        0.85,
                }}
              >
                {alert.action}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
