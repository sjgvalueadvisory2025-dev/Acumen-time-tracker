import { message } from "@/lib/messages";

export function Flash({ m, e }: { m?: string | string[]; e?: string | string[] }) {
  const ok = message(m);
  const err = message(e);
  return (
    <>
      {ok && <p className="flash ok" role="status">{ok}</p>}
      {err && <p className="flash err" role="alert">{err}</p>}
    </>
  );
}
