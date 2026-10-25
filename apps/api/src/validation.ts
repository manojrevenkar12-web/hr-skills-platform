import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";

/** Parses a request body with a zod schema, answering 400 with every problem. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw new BadRequestException(r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return r.data;
}
