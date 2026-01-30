import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  type: "local" | "ssh";
  onExit?: () => void;
  isActive?: boolean;
}

const RESIZE_DEBOUNCE_MS = 100;

function Terminal({ sessionId, type, onExit, isActive = true }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastDimsRef = useRef<{ cols: number; rows: number } | null>(null);

  const sendResize = useCallback(
    (cols: number, rows: number) => {
      if (
        lastDimsRef.current?.cols === cols &&
        lastDimsRef.current?.rows === rows
      ) {
        return;
      }
      lastDimsRef.current = { cols, rows };
      invoke("resize_pty", { sessionId, rows, cols }).catch(console.error);
    },
    [sessionId]
  );

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
      fontWeight: "400",
      lineHeight: 1.25,
      letterSpacing: 0,
      scrollback: 10000,
      allowProposedApi: true,
      theme: {
        // Warm dark theme
        background: "#181715",
        foreground: "#E6E2DC",
        cursor: "#7DA6E8",
        cursorAccent: "#181715",
        selectionBackground: "rgba(125, 166, 232, 0.3)",
        selectionForeground: undefined,
        // ANSI colors - warm variants
        black: "#38352F",
        red: "#E88B8B",
        green: "#9CD68D",
        yellow: "#E8C878",
        blue: "#7DA6E8",
        magenta: "#D4A5D9",
        cyan: "#7FCFCF",
        white: "#B6B0A7",
        brightBlack: "#5A564E",
        brightRed: "#F0A0A0",
        brightGreen: "#B0E0A0",
        brightYellow: "#F0D090",
        brightBlue: "#8FB2EC",
        brightMagenta: "#E0B0E5",
        brightCyan: "#90E0E0",
        brightWhite: "#E6E2DC",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Fit after DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        xterm.focus();
      });
    });

    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    const dataDisposable = xterm.onData((data) => {
      invoke("write_to_pty", { sessionId, data }).catch(console.error);
    });

    const setupSession = async () => {
      try {
        unlistenOutput = await listen<string>(
          `pty-output-${sessionId}`,
          (event) => {
            xterm.write(event.payload);
          }
        );

        unlistenExit = await listen(`pty-exit-${sessionId}`, () => {
          xterm.write("\r\n\x1b[38;5;244m[Session terminée]\x1b[0m\r\n");
          onExit?.();
        });

        if (type === "local") {
          await invoke("create_pty_session", { sessionId });
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const dims = fitAddon.proposeDimensions();
            if (dims) {
              sendResize(dims.cols, dims.rows);
            }
          });
        });
      } catch (error) {
        console.error("[Terminal] Setup error:", error);
        xterm.write(`\x1b[31mErreur: ${error}\x1b[0m\r\n`);
      }
    };

    setupSession();

    const handleResize = () => {
      if (!fitAddonRef.current) return;

      fitAddonRef.current.fit();

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = window.setTimeout(() => {
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims) {
          sendResize(dims.cols, dims.rows);
        }
      }, RESIZE_DEBOUNCE_MS);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      xterm.dispose();
    };
  }, [sessionId, type, onExit, sendResize]);

  // Refocus and refit when terminal becomes active
  useEffect(() => {
    if (isActive && xtermRef.current && fitAddonRef.current) {
      // Small delay to ensure visibility transition is complete
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      });
    }
  }, [isActive]);

  const handleClick = () => {
    xtermRef.current?.focus();
  };

  return (
    <div className="h-full w-full bg-terminal p-3">
      <div
        ref={terminalRef}
        className="h-full w-full"
        onClick={handleClick}
      />
    </div>
  );
}

export default Terminal;
