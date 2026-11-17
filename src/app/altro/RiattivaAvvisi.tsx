'use client';

import { useState } from 'react';
import { riattivaConferme } from '@/lib/conferme';

export function RiattivaAvvisi() {
  const [fatto, setFatto] = useState(false);
  return (
    <section aria-labelledby="conferme" className="mt-6 flex flex-col gap-2 border-t border-rule pt-4">
      <h2 id="conferme" className="font-serif text-lg font-semibold">
        Conferme
      </h2>
      <p className="text-[15px] text-ink-2">
        Prima di eliminare qualcosa di importante l&apos;app chiede conferma. Se hai scelto di non essere avvisato, qui puoi riattivare le conferme.
      </p>
      <button
        type="button"
        onClick={() => {
          riattivaConferme();
          setFatto(true);
        }}
        className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-brand-dark"
      >
        Riattiva gli avvisi
      </button>
      {fatto ? (
        <p role="status" className="text-[15px] text-ink-2">
          Fatto: le conferme sono di nuovo attive.
        </p>
      ) : null}
    </section>
  );
}
