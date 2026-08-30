import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CrmPage from './page';

describe('CrmPage', () => {
  it('starts empty and waits for companies stored in Supabase', () => {
    render(<CrmPage />);
    expect(screen.getByText('Nenhum cliente corresponde aos filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Roberto Lima')).not.toBeInTheDocument();
  });
});
