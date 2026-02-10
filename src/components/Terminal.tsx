import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit, UnlistenFn } from "@tauri-apps/api/event";
import { X, ChevronUp, ChevronDown, CaseSensitive, Regex } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { getTerminalTheme } from "../themes";
import { isModifierPressed } from "../utils";
import type { AppSettings } from "../types";

type TerminalSettings = AppSettings["terminal"];

interface TerminalProps {
  sessionId: string;
  type: "local" | "ssh";
  onExit?: () => void;
  isActive?: boolean;
  appTheme?: string;
  settings?: TerminalSettings;
}

const defaultTerminalSettings: TerminalSettings = {
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  cursorStyle: "bar",
  cursorBlink: true,
  scrollback: 10000,
};

const RESIZE_DEBOUNCE_MS = 100;

function Terminal({ sessionId, type, onExit, isActive = true, appTheme = "dark", settings }: TerminalProps) {
  const terminalSettings = settings ?? defaultTerminalSettings;
  const { t } = useTranslation();
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
      cursorBlink: terminalSettings.cursorBlink,
      cursorStyle: terminalSettings.cursorStyle,
      fontSize: terminalSettings.fontSize,
      fontFamily: `"${terminalSettings.fontFamily}", "SF Mono", Menlo, Consolas, monospace`,
      fontWeight: "400",
      lineHeight: 1.25,
      letterSpacing: 0,
      scrollback: terminalSettings.scrollback,
      allowProposedApi: true,
      allowTransparency: true, // Always enabled for themes with transparency support
      theme: getTerminalTheme(appTheme),
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
    let isScrollingVisible = false;

    // Show scrollbar when not at bottom, hide when at bottom or after delay
    const scrollDisposable = xterm.onScroll(() => {
      if (!xtermElement) return;

      const buffer = xterm.buffer.active;
      const isAtBottom = buffer.viewportY >= buffer.baseY;

      if (!isAtBottom) {
        if (!isScrollingVisible) {
          xtermElement.classList.add('is-scrolling');
          isScrollingVisible = true;
        }
        if (scrollHideTimeout) clearTimeout(scrollHideTimeout);
        scrollHideTimeout = window.setTimeout(() => {
          xtermElement.classList.remove('is-scrolling');
          isScrollingVisible = false;
        }, 1500);
      } else if (isScrollingVisible) {
        if (scrollHideTimeout) clearTimeout(scrollHideTimeout);
        xtermElement.classList.remove('is-scrolling');
        isScrollingVisible = false;
      }
    });

    // Fit after DOM is ready
    requestAnimationFrame(() => {
      fitAddon.fit();
      xterm.focus();
    });

    let isMounted = true;
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    const dataDisposable = xterm.onData((data) => {
      invoke("write_to_pty", { sessionId, data }).catch(console.error);
      emit("terminal-input", { sessionId, data });
    });

    const setupSession = async () => {
      try {
        const outputUn = await listen<string>(
          `pty-output-${sessionId}`,
          (event) => {
            xterm.write(event.payload);
          }
        );
        if (!isMounted) { outputUn(); return; }
        unlistenOutput = outputUn;

        const exitUn = await listen(`pty-exit-${sessionId}`, () => {
          xterm.write(`\r\n\x1b[38;5;244m${t("terminalView.sessionEnded")}\x1b[0m\r\n`);
          onExit?.();
        });
        if (!isMounted) { exitUn(); return; }
        unlistenExit = exitUn;

        if (type === "local") {
          await invoke("create_pty_session", { sessionId });
          if (!isMounted) return;
        }

        requestAnimationFrame(() => {
          if (!isMounted) return;
          const dims = fitAddon.proposeDimensions();
          if (dims) {
            sendResize(dims.cols, dims.rows);
          }
        });
      } catch (error) {
        if (!isMounted) return;
        console.error("[Terminal] Setup error:", error);
        xterm.write(`\x1b[31m${t("terminalView.errorPrefix")}${error}\x1b[0m\r\n`);
      }
    };

    void setupSession();

    let resizeRafId: number | null = null;
    const handleResize = () => {
      if (!fitAddonRef.current) return;

      // Debounce fit() via rAF to avoid layout thrashing
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        fitAddonRef.current?.fit();
      });

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
      isMounted = false;
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (resizeRafId) {
        cancelAnimationFrame(resizeRafId);
      }
      if (scrollHideTimeout) {
        clearTimeout(scrollHideTimeout);
      }
      resizeObserver?.disconnect();
      dataDisposable.dispose();
      scrollDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      xterm.dispose();
    };
  }, [sessionId, type, onExit, sendResize, appTheme]);

  // Update terminal theme when app theme changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme(appTheme);
    }
  }, [appTheme]);

  // Update terminal settings when they change (batched)
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    const fontFamily = `"${terminalSettings.fontFamily}", "SF Mono", Menlo, Consolas, monospace`;
    const needsRefit =
      xterm.options.fontSize !== terminalSettings.fontSize ||
      xterm.options.fontFamily !== fontFamily;

    xterm.options.cursorStyle = terminalSettings.cursorStyle;
    xterm.options.cursorBlink = terminalSettings.cursorBlink;
    xterm.options.scrollback = terminalSettings.scrollback;
    // Font changes last — they trigger internal char-size recalculation
    xterm.options.fontSize = terminalSettings.fontSize;
    xterm.options.fontFamily = fontFamily;

    if (needsRefit && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [terminalSettings]);

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

  // Intercept Mod+F globally to prevent Tauri's native search
  useEffect(() => {
    if (!isActive) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isModifierPressed(e) && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [isActive]);

  return (
    <div className="relative h-full w-full px-2">
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
            title={t("terminalView.caseSensitive")}
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
            title={t("terminalView.regex")}
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
            title={t("terminalView.previousResult")}
          >
            <ChevronUp size={14} />
          </button>

          {/* Next */}
          <button
            onClick={() => handleSearch("next")}
            disabled={!searchQuery}
            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors disabled:opacity-30"
            title={t("terminalView.nextResult")}
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
