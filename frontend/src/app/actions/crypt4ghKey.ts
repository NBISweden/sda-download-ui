"use server";
import { z } from "zod";
import { updateServerToken, SessionInvalidError } from "@/app/lib/serverToken";
import {
  validateCrypt4GHPublicKey,
  Crypt4ghValidationError,
} from "../lib/crypt4gh";
import * as crypto from "crypto";

const Crypt4GHForm = z.object({
  pemFile: z.nullable(z.file()),
  pemKey: z.nullable(z.string()),
  action: z.enum(["submit", "remove"]),
});

type Crypt4GHForm = z.infer<typeof Crypt4GHForm>;

export type PublicKeyData = {
  pemChecksum?: string;
};

export type Crypt4GHFormStateData =
  | PublicKeyData
  | { errors: string[] }
  | { messages: string[] };

export async function postCrypt4GHPublicKey(
  _initialState: Crypt4GHFormStateData,
  data?: FormData,
): Promise<Crypt4GHFormStateData> {
  if (!data) {
    return {
      errors: ["No form data supplied."],
    };
  }

  const validatedFields = Crypt4GHForm.safeParse({
    pemKey: data.get("pemKey"),
    pemFile: data.get("pemFile"),
    action: data.get("action"),
  });

  if (!validatedFields.success) {
    return {
      errors: z.treeifyError(validatedFields.error).errors,
    };
  }

  if (validatedFields.data.action === "remove") {
    await updateServerToken({
      publicKey: null,
    });
    return {
      messages: ["Public key removed."],
    };
  }

  try {
    const { key, pemChecksum } = await parseCrypt4GHPublicKey(
      validatedFields.data,
    );
    await updateServerToken({ publicKey: { key, pemChecksum } });
    return { pemChecksum };
  } catch (e) {
    // Only surface messages from known, user-facing validation errors
    // so that we don't accidentally expose sensitive information.
    if (e instanceof Crypt4ghValidationError) {
      return { errors: [e.message] };
    }
    if (e instanceof SessionInvalidError) {
      return {
        errors: ["Your session is no longer valid. Please sign in again."],
      };
    }
    console.error("crypt4gh key upload failed:", e);
    return {
      errors: ["Could not save the public key. Please try again."],
    };
  }
}

export async function parseCrypt4GHPublicKey(data: Crypt4GHForm) {
  const fileData = data.pemFile ? await data.pemFile.text() : null;
  const pemData = fileData || (data.pemKey ? data.pemKey : null);

  if (!pemData) {
    throw new Crypt4ghValidationError(
      "You need to supply either the content of a public key PEM file or the PEM file itself.",
    );
  }

  const key = validateCrypt4GHPublicKey(pemData);
  const pemChecksum = crypto.createHash("md5").update(pemData).digest("hex");

  return {
    key,
    pemChecksum,
  };
}
