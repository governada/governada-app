import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function Loading() {
  return (
    <main className="container max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10 space-y-2">
        <Skeleton className="h-9 w-80 mx-auto" />
        <Skeleton className="h-4 w-96 mx-auto" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <div className="flex flex-col sm:flex-row gap-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-20 flex-1 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
