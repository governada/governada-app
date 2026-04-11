import { redirect } from 'next/navigation';

/** Profile moved to You/Settings. */
export default function ProfilePage() {
  redirect('/you/settings');
}
