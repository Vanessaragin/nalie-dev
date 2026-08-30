import { redirect } from 'next/navigation';

export default function LegacySalesPage() {
  redirect('/portal/analises?tab=conteudos');
}
