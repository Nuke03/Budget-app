'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-slate-900 p-2 text-white disabled:opacity-60"
    >
      {pending ? 'Accesso in corso...' : 'Accedi'}
    </button>
  );
}
