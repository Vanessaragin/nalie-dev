'use client';

import { useEffect, useState } from 'react';
import styles from './menu-toggle.module.css';

export default function MenuToggle() {
  const [collapsed, setCollapsed] = useState(() =>
    typeof document === 'undefined'
      ? false
      : document.body.classList.contains('menu-collapsed'),
  );
  useEffect(() => {
    if (
      collapsed ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 760px)').matches)
    )
      return;
    let timer = window.setTimeout(() => {
      setCollapsed(true);
      document.body.classList.add('menu-collapsed');
    }, 12000);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setCollapsed(true);
        document.body.classList.add('menu-collapsed');
      }, 12000);
    };
    document.addEventListener('pointerdown', restart);
    document.addEventListener('keydown', restart);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', restart);
      document.removeEventListener('keydown', restart);
    };
  }, [collapsed]);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.body.classList.toggle('menu-collapsed', next);
  }
  return (
    <button
      data-menu-toggle
      className={styles.toggle}
      type="button"
      onClick={toggle}
      aria-label={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
      title={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
    >
      {collapsed ? '☰' : '‹'}
    </button>
  );
}
