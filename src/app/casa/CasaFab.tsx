'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account } from '@/lib/types';
import { AddTransactionSheet } from '../add/AddTransactionSheet';

export function CasaFab({ aggiunta, contiPersonali }: { aggiunta: CasaAggiunta; contiPersonali?: Account[] }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAperto(true)}
        aria-label="Aggiungi spesa di casa"
        className="fixed bottom-28 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[var(--shadow-fab)]"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
      <AddTransactionSheet
        aperto={aperto}
        onClose={() => setAperto(false)}
        personale={null}
        casa={aggiunta}
        contiPersonali={contiPersonali}
        modoIniziale="casa"
        meUserId={aggiunta.meUserId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
