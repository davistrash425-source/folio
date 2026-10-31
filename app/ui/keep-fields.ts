// React resets a form after every action, error or not, so each field goes
// back to its defaultValue and a failed save would wipe what was typed.
// Wrapping the action hands the typed text back with an error, as `fields`,
// for the form to use as its defaults. Passwords are never kept.
export type WithFields<S> = S & { fields?: Record<string, string> };

export function typedFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$") && !/password/i.test(key)) fields[key] = value;
  }
  return fields;
}

export function keepFields<S extends { error?: string }>(action: (prev: S, formData: FormData) => Promise<S>) {
  return async (prev: WithFields<S>, formData: FormData): Promise<WithFields<S>> => {
    const result = await action(prev, formData);
    return result.error ? { ...result, fields: typedFields(formData) } : result;
  };
}
