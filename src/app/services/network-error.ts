/** Keep connectivity failures distinct from invalid credentials or validation errors. */
export function networkErrorMessage(error: unknown, fallback: string): string {
  const failure = error as { status?: number; name?: string; message?: string; error?: { message?: string } } | null;
  if (failure?.status === 0 || failure?.name === 'TimeoutError') {
    return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }
  if (failure?.status && failure.status >= 500) return 'El servicio no está disponible. Inténtalo de nuevo más tarde.';
  return failure?.error?.message || (error instanceof Error && !failure?.status ? error.message : '') || fallback;
}
