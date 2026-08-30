import { redirect } from 'next/navigation';

export default function PortalPage() {
  redirect('/portal/analises?tab=conteudos');
}
