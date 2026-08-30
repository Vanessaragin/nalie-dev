import { redirect } from 'next/navigation';

export default function LegacyProductDecisionPage() {
  redirect('/portal/analises?tab=conteudos');
}
