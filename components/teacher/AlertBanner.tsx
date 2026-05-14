import { TeacherAlert } from "@/lib/types";

const typeStyles: Record<string, string> = {
  urgent: "bg-[#FF4D6A]/10 border-[#FF4D6A]/30 text-[#FF4D6A]",
  warning: "bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]",
  info: "bg-[#00B8FF]/10 border-[#00B8FF]/30 text-[#00B8FF]",
  success: "bg-[#00E5A0]/10 border-[#00E5A0]/30 text-[#00E5A0]",
};

const typeIcons: Record<string, string> = {
  urgent: "⚠",
  warning: "◈",
  info: "◎",
  success: "✓",
};

interface Props {
  alerts: TeacherAlert[];
}

export default function AlertBanner({ alerts }: Props) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${typeStyles[alert.type]}`}
        >
          <span className="flex-shrink-0 font-bold">{typeIcons[alert.type]}</span>
          <span className="flex-1">{alert.message}</span>
          {alert.action && alert.actionHref && (
            <a
              href={alert.actionHref}
              className="flex-shrink-0 underline underline-offset-2 opacity-80 hover:opacity-100 text-xs font-medium"
            >
              {alert.action}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}