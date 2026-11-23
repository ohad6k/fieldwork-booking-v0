import { getProgramme } from '../lib/workshops';
import Studio from './studio';

export const dynamic = 'force-dynamic';

export default async function Page() {
  return <Studio initial={await getProgramme()} />;
}
