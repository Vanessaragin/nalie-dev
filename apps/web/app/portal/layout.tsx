import type { ReactNode } from 'react';
import ButtonActionAudit from './button-action-audit';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="portal-typography">
      <ButtonActionAudit />
      {children}
    </div>
  );
}
