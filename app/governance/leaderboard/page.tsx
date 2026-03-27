import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Leaderboard() {
  redirect('/g?filter=dreps&sort=score');
}
