export const dynamic = 'force-dynamic';

import { VoteTestClient } from './VoteTestClient';

export default function VoteTestPage() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto p-8 text-center">
        <p className="text-muted-foreground">This page is only available in development.</p>
      </div>
    );
  }

  return <VoteTestClient />;
}
