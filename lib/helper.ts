import { customAlphabet } from "nanoid";
import { urlAlphabet } from "nanoid";

const generateSuffix = customAlphabet(urlAlphabet, 10);

export function generateID(type: string): string {
  return `${type.toLocaleLowerCase()}-${generateSuffix()}`;
}
