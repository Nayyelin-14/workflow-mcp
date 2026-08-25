// encryption.ts
// Helpers for encrypting/decrypting sensitive values (e.g. MCP API keys)
// before storing them in the database. Uses AES-256-GCM from Node's crypto
// module, which provides authenticated encryption (data is both encrypted
// AND integrity-checked via the auth tag).
import crypto from "crypto";

// Cipher algorithm used for both directions.
const ALGO = "aes-256-gcm";

// 256-bit key loaded from env (expected as a hex string).
const SECRET_KEY = process.env.MCP_SECRET_KEY!;

// Encrypts a plaintext string and returns a self-contained payload in the
// format "<iv>:<ciphertext>:<authTag>", all hex-encoded. Each call uses a
// fresh random IV so the same input never produces the same output.
export function encryption(key: string) {
  // Generate a unique 32-byte initialization vector per encryption.
  const iv = crypto.randomBytes(32);
  const cipher = crypto.createCipheriv(
    ALGO,
    Buffer.from(SECRET_KEY, "hex"),
    iv,
  );

  // Encrypt the plaintext in one shot.
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  // Return IV + ciphertext + GCM auth tag; all three are needed to decrypt.
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${cipher.getAuthTag().toString("hex")}`;
}

// Decrypts a string produced by `encryption`. Reconstructs the IV, ciphertext,
// and auth tag from the colon-separated payload, verifies integrity, and
// returns the original plaintext.
export function decryption(encryptedKey: string) {
  // Split the stored payload back into its three parts.
  const [iv, data, tag] = encryptedKey.split(":");

  const decipher = crypto.createDecipheriv(
    ALGO,
    Buffer.from(SECRET_KEY, "hex"),
    Buffer.from(iv, "hex"),
  );

  // Provide the auth tag so GCM can verify the ciphertext wasn't tampered with.
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return decipher.update(Buffer.from(data, "hex")) + decipher.final("utf8");
}
