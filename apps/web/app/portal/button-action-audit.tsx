'use client';

import { useEffect } from 'react';
import { recordPortalActivity } from '../../lib/record-portal-activity';

export default function ButtonActionAudit() {
  useEffect(() => {
    const key = 'nalie:login-audit-recorded';
    const storage = window.sessionStorage;
    if (typeof storage?.getItem === 'function' && storage.getItem(key)) return;
    if (typeof storage?.setItem === 'function') storage.setItem(key, 'true');
    void recordPortalActivity('LOGIN', 'Acesso ao portal');
  }, []);
  return null;
}
