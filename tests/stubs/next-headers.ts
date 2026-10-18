// Stands in for "next/headers" in unit tests: one fake request whose cookies
// and headers tests can read and change.
export const cookieJar = new Map<string, string>();
export const requestHeaders = new Headers();

export async function cookies() {
  return {
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  };
}

export async function headers() {
  return requestHeaders;
}
