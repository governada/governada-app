export default function Loading() {
  return (
    <div
      className="flex items-center justify-center min-h-[60vh]"
      role="status"
      aria-label="Loading page content"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
