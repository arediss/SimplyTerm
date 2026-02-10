import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "../FormField";
import { Cable, RefreshCw } from "lucide-react";
import type { SerialPortInfo } from "../../types";

type DataBits = 5 | 6 | 7 | 8;
type StopBits = 1 | 2;
type Parity = "none" | "odd" | "even";
type FlowControl = "none" | "hardware" | "software";

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const DATA_BITS: DataBits[] = [5, 6, 7, 8];
const STOP_BITS: StopBits[] = [1, 2];
const PARITY_OPTIONS: Parity[] = ["none", "odd", "even"];
const FLOW_CONTROL_OPTIONS: FlowControl[] = ["none", "hardware", "software"];

export interface SerialFormContentProps {
  name: string;
  setName: (v: string) => void;
  port: string;
  setPort: (v: string) => void;
  baudRate: number;
  setBaudRate: (v: number) => void;
  dataBits: 5 | 6 | 7 | 8;
  setDataBits: (v: 5 | 6 | 7 | 8) => void;
  stopBits: 1 | 2;
  setStopBits: (v: 1 | 2) => void;
  parity: "none" | "odd" | "even";
  setParity: (v: "none" | "odd" | "even") => void;
  flowControl: "none" | "hardware" | "software";
  setFlowControl: (v: "none" | "hardware" | "software") => void;
  availablePorts: SerialPortInfo[];
  isLoadingPorts: boolean;
  onRefreshPorts: () => void;
  getPortDescription: (p: SerialPortInfo) => string;
}

export const SerialFormContent = memo(function SerialFormContent(props: SerialFormContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Name + Port */}
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
        <FormField
          label={t("connection.serial.port")}
          icon={<Cable size={12} />}
          action={
            <button
              type="button"
              onClick={props.onRefreshPorts}
              disabled={props.isLoadingPorts}
              className="p-0.5 text-text-muted hover:text-text transition-colors"
              title={t("common.refresh")}
            >
              <RefreshCw size={12} className={props.isLoadingPorts ? "animate-spin" : ""} />
            </button>
          }
        >
          <select
            value={props.port}
            onChange={(e) => props.setPort(e.target.value)}
            required
            className="input-field"
          >
            {props.availablePorts.length === 0 ? (
              <option value="">{t("connection.serial.noPorts")}</option>
            ) : (
              props.availablePorts.map((p) => (
                <option key={p.port_name} value={p.port_name}>
                  {p.port_name} - {props.getPortDescription(p)}
                </option>
              ))
            )}
          </select>
        </FormField>
      </div>

      {/* Row 2: Baud Rate + Data Bits */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.baudRate")}>
          <select
            value={props.baudRate}
            onChange={(e) => props.setBaudRate(Number.parseInt(e.target.value))}
            className="input-field"
          >
            {BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t("connection.serial.dataBits")}>
          <select
            value={props.dataBits}
            onChange={(e) => props.setDataBits(Number.parseInt(e.target.value) as 5 | 6 | 7 | 8)}
            className="input-field"
          >
            {DATA_BITS.map((bits) => (
              <option key={bits} value={bits}>
                {bits}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Row 3: Stop Bits + Parity */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.stopBits")}>
          <select
            value={props.stopBits}
            onChange={(e) => props.setStopBits(Number.parseInt(e.target.value) as 1 | 2)}
            className="input-field"
          >
            {STOP_BITS.map((bits) => (
              <option key={bits} value={bits}>
                {bits}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t("connection.serial.parity")}>
          <select
            value={props.parity}
            onChange={(e) => props.setParity(e.target.value as "none" | "odd" | "even")}
            className="input-field"
          >
            {PARITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {t(`connection.serial.parity${p.charAt(0).toUpperCase() + p.slice(1)}`)}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Row 4: Flow Control */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.flowControl")}>
          <select
            value={props.flowControl}
            onChange={(e) =>
              props.setFlowControl(e.target.value as "none" | "hardware" | "software")
            }
            className="input-field"
          >
            {FLOW_CONTROL_OPTIONS.map((fc) => (
              <option key={fc} value={fc}>
                {t(`connection.serial.flow${fc.charAt(0).toUpperCase() + fc.slice(1)}`)}
              </option>
            ))}
          </select>
        </FormField>
        <div />
      </div>
    </div>
  );
});
