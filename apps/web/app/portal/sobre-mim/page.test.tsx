import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from './page';

describe('AboutPage', () => {
  it('shows the professional proposal and contact placeholders', () => {
    render(<AboutPage />);
    expect(
      screen.getByRole('heading', { name: 'Sobre mim e contatos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Foto de Vanessa Rodrigues' }),
    ).toHaveAttribute('src', '/vanessa-login.jpeg');
    expect(screen.queryByText('Alterar foto oficial')).not.toBeInTheDocument();
    expect(screen.getByText('contato@nalie.com')).toBeInTheDocument();
  });
});
