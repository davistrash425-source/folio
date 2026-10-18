// Stands in for "next/cache" in unit tests: there's no Next cache to clear, so
// the calls are recorded for tests that want to check a change refreshed it.
export const revalidated: string[] = [];

export function revalidateTag(tag: string) {
  revalidated.push(`tag:${tag}`);
}

export function revalidatePath(path: string) {
  revalidated.push(`path:${path}`);
}

export function cacheLife() {}

export function cacheTag() {}
