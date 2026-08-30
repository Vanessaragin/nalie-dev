import { redirect } from 'next/navigation';

export default function LegacyFuelPage() {
  redirect('/portal/analises?tab=conteudos');
}
