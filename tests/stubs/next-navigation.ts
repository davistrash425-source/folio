// Stands in for "next/navigation" in unit tests. Next's redirect() and
// notFound() stop the code that called them by throwing; these do the same, so
// tests can check where a visitor would have been sent.
export class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`redirect to ${url}`);
    this.url = url;
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("not found");
  }
}

export function redirect(url: string): never {
  throw new RedirectError(url);
}

export function notFound(): never {
  throw new NotFoundError();
}
