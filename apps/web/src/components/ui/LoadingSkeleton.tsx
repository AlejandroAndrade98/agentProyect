type LoadingSkeletonProps = {
  rows?: number;
};

export function LoadingSkeleton({ rows = 6 }: LoadingSkeletonProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}