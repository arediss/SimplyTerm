import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { X, ChevronUp, ChevronDown, CaseSensitive, Regex } from "lucide-react";
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
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastDimsRef = useRef<{ cols: number; rows: number } | null>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    const searchAddon = new SearchAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);

    // Intercept Ctrl+F to open search
    xterm.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === "f" && event.type === "keydown") {
        setIsSearchOpen(true);
        return false; // Prevent default
      }
      if (event.key === "Escape" && event.type === "keydown") {
        setIsSearchOpen(false);
        searchAddon.clearDecorations();
        return true; // Let terminal handle it too
      }
      return true;
    });

    xterm.open(terminalRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Get xterm container for scrollbar visibility control
    const xtermElement = terminalRef.current.querySelector('.xterm');
    let scrollHideTimeout: number | null = null;

    // Show scrollbar when not at bottom, hide when at bottom or after delay
    const scrollDisposable = xterm.onScroll(() => {
      if (!xtermElement) return;

      const buffer = xterm.buffer.active;
      const isAtBottom = buffer.viewportY >= buffer.baseY;

      if (!isAtBottom) {
        xtermElement.classList.add('is-scrolling');
        // Clear existing timeout
        if (scrollHideTimeout) clearTimeout(scrollHideTimeout);
        // Hide after 1.5s of no scroll
        scrollHideTimeout = window.setTimeout(() => {
          xtermElement.classList.remove('is-scrolling');
        }, 1500);
      } else {
        // At bottom - hide immediately
        if (scrollHideTimeout) clearTimeout(scrollHideTimeout);
        xtermElement.classList.remove('is-scrolling');
      }
    });

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
      if (scrollHideTimeout) {
        clearTimeout(scrollHideTimeout);
      }
      resizeObserver.disconnect();
      dataDisposable.dispose();
      scrollDisposable.dispose();
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

  // Search functions
  const handleSearch = useCallback((direction: "next" | "prev") => {
    if (!searchAddonRef.current || !searchQuery) return;

    const options = {
      caseSensitive,
      regex: useRegex,
      incremental: direction === "next",
    };

    if (direction === "next") {
      searchAddonRef.current.findNext(searchQuery, options);
    } else {
      searchAddonRef.current.findPrevious(searchQuery, options);
    }
  }, [searchQuery, caseSensitive, useRegex]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchAddonRef.current && value) {
      searchAddonRef.current.findNext(value, {
        caseSensitive,
        regex: useRegex,
        incremental: true,
      });
    } else if (searchAddonRef.current) {
      searchAddonRef.current.clearDecorations();
    }
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery("");
    searchAddonRef.current?.clearDecorations();
    xtermRef.current?.focus();
  };

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchOpen]);

  // Intercept Ctrl+F globally to prevent Tauri's native search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
      }
    };

    // Only add listener when terminal is active
    if (isActive) {
      document.addEventListener("keydown", handleGlobalKeyDown, true);
      return () => document.removeEventListener("keydown", handleGlobalKeyDown, true);
    }
  }, [isActive]);

  return (
    <div className="relative h-full w-full bg-terminal pl-3 pt-3 pb-1">
      <div
        ref={terminalRef}
        className="h-full w-full"
        onClick={handleClick}
      />

      {/* Search Panel */}
      {isSearchOpen && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1.5 bg-mantle/95 backdrop-blur-xl border border-surface-0/50 rounded-xl shadow-lg">
          {/* Search Input */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch(e.shiftKey ? "prev" : "next");
              } else if (e.key === "Escape") {
                closeSearch();
              }
            }}
            placeholder="Rechercher..."
            className="w-48 px-2 py-1 bg-surface-0/50 border border-surface-0 rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent/50"
          />

          {/* Case Sensitive Toggle */}
          <button
            onClick={() => {
              setCaseSensitive(!caseSensitive);
              if (searchQuery) handleSearch("next");
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              caseSensitive
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text hover:bg-surface-0/50"
            }`}
            title="Sensible à la casse (Aa)"
          >
            <CaseSensitive size={14} />
          </button>

          {/* Regex Toggle */}
          <button
            onClick={() => {
              setUseRegex(!useRegex);
              if (searchQuery) handleSearch("next");
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              useRegex
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text hover:bg-surface-0/50"
            }`}
            title="Expression régulière (.*)"
          >
            <Regex size={14} />
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-surface-0/50" />

          {/* Previous */}
          <button
            onClick={() => handleSearch("prev")}
            disabled={!searchQuery}
            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors disabled:opacity-30"
            title="Précédent (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>

          {/* Next */}
          <button
            onClick={() => handleSearch("next")}
            disabled={!searchQuery}
            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors disabled:opacity-30"
            title="Suivant (Enter)"
          >
            <ChevronDown size={14} />
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-surface-0/50" />

          {/* Close */}
          <button
            onClick={closeSearch}
            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors"
            title="Fermer (Escape)"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Terminal;
