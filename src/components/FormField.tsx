interface FormFieldProps {
  label: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({ label, icon, action, children }: Readonly<FormFieldProps>) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1 text-xs text-text-muted">
          {icon}
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}
