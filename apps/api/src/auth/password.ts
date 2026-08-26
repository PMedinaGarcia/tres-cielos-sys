import { randomBytes } from "crypto";
import { argon2id, argon2Verify } from "hash-wasm";

/** OWASP 2024: argon2id, 19 MiB, t=2, p=1 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password: plain,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2Verify({ password: plain, hash });
  } catch {
    return false;
  }
}
