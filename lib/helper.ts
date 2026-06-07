import { nanoid } from "nanoid";
export function generateID(type: string): string {
  return `${type.toLocaleLowerCase()}-${nanoid(10)}`;
}
