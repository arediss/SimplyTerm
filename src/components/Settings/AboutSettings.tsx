import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import {
  Terminal,
  Github,
  BookOpen,
  Heart,
  Copy,
  Check,
} from "lucide-react";
import { SettingGroup, LinkButton } from "./SettingsUIComponents";

export default function AboutSettings() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState<string>("...");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("?"));
  }, []);

  const handleCopyVersion = () => {
    navigator.clipboard.writeText(`SimplyTerm v${appVersion}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* App header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-surface-0/20 to-surface-0/10 p-6">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent/5 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-crust/80 border border-surface-0/30 flex items-center justify-center shadow-lg">
            <Terminal size={28} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-text tracking-tight">SimplyTerm</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {t("settings.about.tagline")}
            </p>
            <button
              onClick={handleCopyVersion}
              className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-crust/60 rounded-md text-[11px] text-text-muted hover:text-text transition-colors"
            >
              {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
              v{appVersion}
            </button>
          </div>
        </div>
      </div>

      {/* Tech stack */}
      <SettingGroup title={t("settings.about.techTitle")} description={t("settings.about.techDesc")}>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Tauri v2", color: "text-yellow" },
            { name: "React", color: "text-blue" },
            { name: "TypeScript", color: "text-blue" },
            { name: "Rust", color: "text-peach" },
            { name: "xterm.js", color: "text-green" },
          ].map((tech) => (
            <span
              key={tech.name}
              className="px-3 py-1.5 bg-surface-0/30 border border-surface-0/20 rounded-lg text-xs text-text-muted"
            >
              <span className={tech.color}>&#x2022;</span> {tech.name}
            </span>
          ))}
        </div>
      </SettingGroup>

      {/* Links */}
      <SettingGroup title={t("settings.about.linksTitle")} description={t("settings.about.linksDesc")}>
        <div className="space-y-2">
          <LinkButton
            icon={<Github size={18} />}
            title={t("settings.about.sourceCode")}
            description={t("settings.about.viewOnGithub")}
            href="https://github.com/arediss/SimplyTerm"
          />
          <LinkButton
            icon={<BookOpen size={18} />}
            title={t("settings.about.documentation")}
            description={t("settings.about.userGuide")}
            href="https://github.com/arediss/SimplyTerm/wiki"
          />
        </div>
      </SettingGroup>

      {/* Footer */}
      <div className="pt-4 border-t border-surface-0/30">
        <p className="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
          {t("settings.about.footer")} <Heart size={10} className="text-red inline" />
        </p>
      </div>
    </div>
  );
}
