import { useTranslation } from "react-i18next";
import { Wifi, Cable, Terminal } from "lucide-react";

export type ConnectionType = "ssh" | "telnet" | "serial";

interface ConnectionTypeSelectorProps {
  selected: ConnectionType;
  onChange: (type: ConnectionType) => void;
}

export function ConnectionTypeSelector({ selected, onChange }: ConnectionTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex p-1 bg-crust rounded-lg mb-4">
      <TypeButton
        active={selected === "ssh"}
        onClick={() => onChange("ssh")}
        icon={<Terminal size={14} />}
        label={t("connection.types.ssh")}
      />
      <TypeButton
        active={selected === "telnet"}
        onClick={() => onChange("telnet")}
        icon={<Wifi size={14} />}
        label={t("connection.types.telnet")}
      />
      <TypeButton
        active={selected === "serial"}
        onClick={() => onChange("serial")}
        icon={<Cable size={14} />}
        label={t("connection.types.serial")}
      />
    </div>
  );
}

interface TypeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TypeButton({ active, onClick, icon, label }: TypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 py-2 px-3 rounded-md text-xs transition-all flex items-center justify-center gap-2
        ${active ? "bg-surface-0 text-text shadow-sm" : "text-text-muted hover:text-text"}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

export default ConnectionTypeSelector;
