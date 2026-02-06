import { useTranslation } from "react-i18next";
import { modifierKey } from "../utils";

export default function EmptyState({ onNewConnection }: { onNewConnection: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-accent/[0.02]" />

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo mark */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-surface-0/40 to-surface-0/20 flex items-center justify-center border border-surface-0/30">
            <span className="text-4xl text-accent/70">{"\u2B21"}</span>
          </div>
          <div className="absolute -inset-4 bg-accent/5 rounded-full blur-2xl -z-10" />
        </div>

        {/* Text */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text tracking-tight mb-2">
            SimplyTerm
          </h1>
          <p className="text-sm text-text-muted max-w-xs">
            {t('app.tagline')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onNewConnection}
            className="px-5 py-2.5 bg-accent text-crust text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors"
          >
            {t('app.newConnection')}
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-xs text-text-muted/60">
          {t('app.shortcutHint', { modifier: modifierKey })}
        </p>
      </div>
    </div>
  );
}
