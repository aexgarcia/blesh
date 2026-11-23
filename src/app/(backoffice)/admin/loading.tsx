import { CardSkeleton, Skeleton } from "@/shared/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-72 rounded-full" />
      <CardSkeleton />
    </div>
  );
}
