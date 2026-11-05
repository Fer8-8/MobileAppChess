import { networkErrorMessage } from './network-error';

describe('Network error messages', () => {
  it('distinguishes unreachable servers and timeouts from bad credentials', () => {
    expect(networkErrorMessage({ status: 0 }, 'Credenciales incorrectas')).toContain('conexión');
    expect(networkErrorMessage({ name: 'TimeoutError' }, 'Credenciales incorrectas')).toContain('conexión');
    expect(networkErrorMessage({ status: 401, error: { message: 'Credenciales incorrectas' } }, 'Error')).toBe('Credenciales incorrectas');
  });
  it('reports temporary server failures', () => {
    expect(networkErrorMessage({ status: 503 }, 'Error')).toContain('servicio no está disponible');
  });
});
