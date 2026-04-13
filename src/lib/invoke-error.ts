export type InvokeErrorKind = "pro_gate" | "rate_limit" | "connection" | "timeout" | "generic";

export async function classifyInvokeError(err: unknown): Promise<InvokeErrorKind> {
  if (!(err instanceof Error)) return "generic";

  const context = (err as unknown as Record<string, unknown>).context as
    | { status: number; clone?: () => any; json: () => Promise<unknown> }
    | undefined;

  if (!context) return "connection"; // network failure — no HTTP response

  const { status } = context;

  if (status === 429) {
    try {
      const responseClone = typeof context.clone === 'function' ? context.clone() : context;
      const body = await responseClone.json();
      if (
        body &&
        typeof (body as Record<string, unknown>).error === "string" &&
        ((body as Record<string, unknown>).error as string).includes("Pro subscription")
      ) {
        return "pro_gate";
      }
    } catch {
      // body unreadable
    }
    return "rate_limit";
  }

  if (status === 504) return "timeout";

  return "generic";
}

export async function getInvokeErrorMessage(err: unknown): Promise<string | null> {
  if (!(err instanceof Error)) return null;
  const context = (err as unknown as Record<string, unknown>).context as
    | { clone?: () => any; json: () => Promise<unknown> }
    | undefined;
  if (!context) return err.message;

  try {
    const responseClone = typeof context.clone === 'function' ? context.clone() : context;
    const body = await responseClone.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {}

  return err.message;
}

