import Terminal from "./Terminal";

interface TerminalPaneProps {
  sessionId: string;
  type: "local" | "ssh";
  isActive?: boolean;
}

function TerminalPane({ sessionId, type, isActive = true }: TerminalPaneProps) {
  return (
    <div className="h-full w-full">
      <Terminal sessionId={sessionId} type={type} isActive={isActive} />
    </div>
  );
}

export default TerminalPane;
