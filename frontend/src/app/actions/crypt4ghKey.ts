"use server";
import { z } from "zod";
import { createOrUpdateSession } from "@/app/lib/session";
import { validateCrypt4GHPublicKey } from "../lib/crypt4gh";
import * as crypto from "crypto";

const Crypt4GHForm = z.object({
  pemFile: z.optional(z.file()),
  pemKey: z.optional(z.string()),
});

type Crypt4GHForm = z.infer<typeof Crypt4GHForm>;

export type PublicKeyData = {
  pemChecksum?: string;
};

export async function postCrypt4GHPublicKey(
  _initialState: PublicKeyData | { errors: string[] },
  data?: FormData,
): Promise<{ pemChecksum: string } | { errors: string[] }> {
  if (!data) {
    return {
      errors: ["No form data supplied."],
    };
  }

  const validatedFields = Crypt4GHForm.safeParse({
    pemKey: data.get("pemKey"),
    pemFile: data.get("pemFile"),
  });

  if (!validatedFields.success) {
    return {
      errors: z.treeifyError(validatedFields.error).errors,
    };
  }
  try {
    const { key, pemChecksum } = await parseCrypt4GHPublicKey(
      validatedFields.data,
    );
    await createOrUpdateSession({
      publicKey: {
        key,
        pemChecksum,
      },
    });
    return {
      pemChecksum,
    };
  } catch (e) {
    return {
      errors: [String(e)],
    };
  }
}

export async function parseCrypt4GHPublicKey(data: Crypt4GHForm) {
  const fileData = data.pemFile ? await data.pemFile.text() : null;
  const pemData = fileData || (data.pemKey ? data.pemKey : null);

  if (!pemData) {
    throw new Error("Either 'pemFile' or 'pemKey' need to be supplied.");
  }

  const key = validateCrypt4GHPublicKey(pemData);
  const pemChecksum = crypto.createHash("md5").update(pemData).digest("hex");

  return {
    key,
    pemChecksum,
  };
}
