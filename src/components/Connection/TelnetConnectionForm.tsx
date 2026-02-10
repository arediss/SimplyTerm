import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "../FormField";
import { Server, AlertTriangle } from "lucide-react";

export interface TelnetFormContentProps {
  name: string;
  setName: (v: string) => void;
  host: string;
  setHost: (v: string) => void;
  port: number;
  setPort: (v: number) => void;
}

export const TelnetFormContent = memo(function TelnetFormContent(props: TelnetFormContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {/* Warning */}
      <div className="flex items-start gap-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning">{t("connection.telnetWarning")}</p>
      </div>

      {/* Row 1: Name + Host */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.nameOptional")}>
          <input
            type="text"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder={t("connection.namePlaceholder")}
            className="input-field"
          />
        </FormField>
        <FormField label={t("connection.host")} icon={<Server size={12} />}>
          <input
            type="text"
            value={props.host}
            onChange={(e) => props.setHost(e.target.value)}
            placeholder="towel.blinkenlights.nl"
            required
            className="input-field"
          />
        </FormField>
      </div>

      {/* Row 2: Port */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.port")}>
          <input
            type="number"
            value={props.port}
            onChange={(e) => props.setPort(Number.parseInt(e.target.value) || 23)}
            min={1}
            max={65535}
            className="input-field"
          />
        </FormField>
        <div />
      </div>
    </div>
  );
});
