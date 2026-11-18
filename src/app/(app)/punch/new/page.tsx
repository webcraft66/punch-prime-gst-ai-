import { PageHeader } from '@/components/ui';
import { aiConfigured } from '@/lib/ai/extract';
import { pageCtx } from '@/lib/page';
import Uploader from './Uploader';

export const metadata = { title: 'Punch a bill' };
export default async function NewPunch() {
  await pageCtx('punch.create');
  return (<div><PageHeader title="Punch a bill" subtitle="Upload a photo or PDF of a supplier bill, or paste its text." /><Uploader ai={aiConfigured()} /></div>);
}
