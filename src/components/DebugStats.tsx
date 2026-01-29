import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, MemoryStick } from "lucide-react";

interface ProcessStats {
  memory_mb: number;
  cpu_percent: number;
}

function DebugStats() {
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await invoke<ProcessStats>("get_process_stats");
        setStats(result);
      } catch (error) {
        console.error("Failed to fetch process stats:", error);
      }
    };

    // Initial fetch
    fetchStats();

    // Update every 2 seconds
    const interval = setInterval(fetchStats, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const memoryColor =
    stats.memory_mb > 500 ? "text-error" : stats.memory_mb > 200 ? "text-warning" : "text-success";
  const cpuColor =
    stats.cpu_percent > 50 ? "text-error" : stats.cpu_percent > 20 ? "text-warning" : "text-success";

  return (
    <div
      className="fixed bottom-3 right-3 z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          flex items-center gap-3 px-3 py-2 rounded-lg
          bg-crust/90 backdrop-blur-sm border border-surface-0/30
          text-xs font-mono transition-all duration-200
          ${isHovered ? "opacity-100" : "opacity-60"}
        `}
      >
        {/* RAM */}
        <div className="flex items-center gap-1.5">
          <MemoryStick size={12} className="text-text-muted" />
          <span className={memoryColor}>{stats.memory_mb.toFixed(1)}</span>
          <span className="text-text-muted">MB</span>
        </div>

        {/* Separator */}
        <div className="w-px h-3 bg-surface-0/50" />

        {/* CPU */}
        <div className="flex items-center gap-1.5">
          <Cpu size={12} className="text-text-muted" />
          <span className={cpuColor}>{stats.cpu_percent.toFixed(1)}</span>
          <span className="text-text-muted">%</span>
        </div>

        {/* DEV badge */}
        <div className="px-1.5 py-0.5 bg-accent/20 text-accent text-[10px] rounded">
          DEV
        </div>
      </div>
    </div>
  );
}

export default DebugStats;
