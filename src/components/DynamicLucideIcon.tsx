import { lazy, Suspense, useMemo } from "react";
import type { LucideProps } from "lucide-react";

// Cache lazy components to avoid re-creating them
const iconCache = new Map<string, React.LazyExoticComponent<React.ComponentType<LucideProps>>>();

function toLazyIcon(iconName: string) {
  // iconName is kebab-case, e.g. "arrow-left"
  if (!iconCache.has(iconName)) {
    iconCache.set(
      iconName,
      lazy(() =>
        import(/* @vite-ignore */ `lucide-react/dist/esm/icons/${iconName}.js`)
          .then((mod) => ({ default: mod.default as React.ComponentType<LucideProps> }))
          .catch(() => ({ default: (() => null) as unknown as React.ComponentType<LucideProps> }))
      )
    );
  }
  return iconCache.get(iconName)!;
}

interface DynamicLucideIconProps extends Omit<LucideProps, "ref"> {
  name: string;
}

export default function DynamicLucideIcon({ name, ...props }: DynamicLucideIconProps) {
  const IconComponent = useMemo(() => toLazyIcon(name), [name]);

  return (
    <Suspense fallback={<span style={{ width: props.size, height: props.size }} />}>
      <IconComponent {...props} />
    </Suspense>
  );
}
