import Terminal from "./Terminal";
import type { AppSettings } from "../types";

interface TerminalPaneProps {
  sessionId: string;
  type: "local" | "ssh";
  isActive?: boolean;
  appTheme?: string;
  terminalSettings?: AppSettings["terminal"];
}

function TerminalPane({
  sessionId,
  type,
  isActive = true,
  appTheme = "dark",
  terminalSettings,
}: TerminalPaneProps) {
  return (
    <Terminal
      sessionId={sessionId}
      type={type}
      isActive={isActive}
      appTheme={appTheme}
      settings={terminalSettings}
    />
  );
}

export default TerminalPane;
