import { ChevronRight } from "lucide-react";

export function SettingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-text">{title}</h4>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-text-muted">{icon}</div>
        <div>
          <div className="text-sm font-medium text-text">{title}</div>
          <div className="text-xs text-text-muted">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`
        w-11 h-6 rounded-full transition-colors relative
        ${checked ? "bg-accent" : "bg-surface-0"}
      `}
    >
      <div
        className={`
          absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
          ${checked ? "translate-x-6" : "translate-x-1"}
        `}
      />
    </button>
  );
}

export function ThemeCard({
  name,
  active,
  colors,
  onClick,
}: {
  name: string;
  active: boolean;
  colors: string[];
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all
        ${active
          ? "ring-2 ring-accent bg-accent/10"
          : "hover:bg-white/5"
        }
      `}
    >
      <div className="flex gap-1">
        {colors.map((color, i) => (
          <div
            key={i}
            className="w-8 h-12 rounded-md first:rounded-l-lg last:rounded-r-lg"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="text-xs text-text-muted">{name}</span>
    </button>
  );
}

export function LinkButton({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg bg-surface-0/20 hover:bg-surface-0/30 transition-colors group"
    >
      <div className="text-text-muted group-hover:text-accent transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <ChevronRight size={16} className="text-text-muted group-hover:text-text transition-colors" />
    </a>
  );
}
