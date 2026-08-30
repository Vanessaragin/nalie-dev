import { redirect } from 'next/navigation';

export default function LegacyProductsPage() {
  redirect('/portal/analises?tab=conteudos');
}
