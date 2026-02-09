import Terminal from "./Terminal";

interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorStyle: "block" | "bar" | "underline";
  cursorBlink: boolean;
  scrollback: number;
}

interface TerminalPaneProps {
  sessionId: string;
  type: "local" | "ssh";
  isActive?: boolean;
  appTheme?: string;
  terminalSettings?: TerminalSettings;
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
