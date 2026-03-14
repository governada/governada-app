interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
      {icon && <div className="text-muted-foreground mx-auto w-8 h-8">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
