'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <span className="text-3xl font-bold text-primary font-mono">$</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
        <p className="text-muted-foreground leading-relaxed">
          DRepScore needs an internet connection for live governance data. Please check your
          connection and refresh.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
