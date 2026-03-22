type ClassDictionary = Record<string, boolean | null | undefined>;
type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassDictionary
  | ClassValue[];

function appendClass(input: ClassValue, output: string[]) {
  if (!input) return;

  if (typeof input === "string" || typeof input === "number") {
    output.push(String(input));
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value) => appendClass(value, output));
    return;
  }

  Object.entries(input).forEach(([key, value]) => {
    if (value) output.push(key);
  });
}

export function cn(...inputs: ClassValue[]): string {
  const output: string[] = [];
  inputs.forEach((input) => appendClass(input, output));
  return output.join(" ");
}
