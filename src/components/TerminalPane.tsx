import Terminal from "./Terminal";

interface TerminalPaneProps {
  sessionId: string;
  type: "local" | "ssh";
  isActive?: boolean;
  appTheme?: string;
}

function TerminalPane({ sessionId, type, isActive = true, appTheme = "dark" }: TerminalPaneProps) {
  return (
    <div className="h-full w-full">
      <Terminal sessionId={sessionId} type={type} isActive={isActive} appTheme={appTheme} />
    </div>
  );
}

export default TerminalPane;
