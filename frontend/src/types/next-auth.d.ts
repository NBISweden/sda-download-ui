import "next-auth/jwt";
import "next-auth";

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    publicKey?: {
      key: string;
      pemChecksum: string;
    } | null;
  }
}

declare module "next-auth" {
  interface Session {
    pemChecksum?: string | null;
  }
}
