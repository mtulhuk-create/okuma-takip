// Sayfa geçişlerinde anında gösterilen iskelet
export default function Loading() {
  return (
    <div className="space-y-4 pt-4" aria-busy="true">
      <div className="skeleton h-8 w-40" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <div className="skeleton h-44" />
      <div className="skeleton h-32" />
    </div>
  );
}
