import { customAlphabet } from "nanoid";
import { urlAlphabet } from "nanoid";
import Mustache from "mustache";
const generateSuffix = customAlphabet(urlAlphabet, 10);

export function generateID(type: string): string {
  return `${type.toLocaleLowerCase()}-${generateSuffix()}`;
}

export function replacesdVariables(
  template: string,
  variables: Record<string, any>,
) {
  return Mustache.render(template, variables);
}
