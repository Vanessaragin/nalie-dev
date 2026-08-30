import { redirect } from 'next/navigation';

export default function LegacyLaborPage() {
  redirect('/portal/analises?tab=conteudos');
}
