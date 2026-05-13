export function validateCrypt4GHPublicKey(pemKey: string) {
  const m = pemKey.match(
    /-----BEGIN CRYPT4GH PUBLIC KEY-----\s+(.*?)\s+-----END CRYPT4GH PUBLIC KEY-----/,
  );
  if (!m) {
    throw new Error("Missing PEM header and/or footer for PUBLIC key.");
  }

  const expectedKeyLength = 44;
  const key = m[1];
  if (key.length != expectedKeyLength) {
    throw new Error(
      `Incorrect key length ${key.length}. Expected ${expectedKeyLength}.`,
    );
  }

  return key;
}
