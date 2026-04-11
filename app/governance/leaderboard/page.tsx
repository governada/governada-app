import { redirect } from 'next/navigation';

export default function Leaderboard() {
  redirect('/?filter=dreps&sort=score');
}
