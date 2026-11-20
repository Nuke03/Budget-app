import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useState } from 'react';
import { ApriFoglio } from '@/app/anteprima/ApriFoglio';

function Finto() {
  const [menu, setMenu] = useState(false);
  const [spesa, setSpesa] = useState(false);
  return (
    <>
      <button aria-label="Cosa vuoi fare?" onClick={() => setMenu(true)} />
      {menu ? (
        <div role="dialog">
          <button onClick={() => setSpesa(true)}>Registra una spesa</button>
        </div>
      ) : null}
      {spesa ? <p>foglio spesa</p> : null}
    </>
  );
}

describe('ApriFoglio', () => {
  it('apre il menu e sceglie "Registra una spesa"', async () => {
    vi.useFakeTimers();
    render(
      <>
        <Finto />
        <ApriFoglio />
      </>,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    vi.useRealTimers();
    expect(screen.getByText('foglio spesa')).toBeInTheDocument();
  });
});
