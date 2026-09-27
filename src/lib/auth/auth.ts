import { randomBytes } from "node:crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { hashSync } from "@node-rs/argon2";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/lib/auth/auth.config";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

/**
 * Node-runtime Auth.js instance: the edge-safe config plus the Prisma adapter and the
 * email/password provider. Never import this from middleware.
 */

/**
 * A genuine argon2id hash of a random secret, computed once at startup. Verifying
 * against it makes a sign-in attempt for an unknown address cost the same as one for a
 * known address, closing the timing side-channel that would otherwise enumerate users.
 */
const DUMMY_HASH = hashSync(randomBytes(32).toString("hex"));

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Throttle per email address. Returning null (rather than throwing) keeps the
        // response identical to a wrong password, so this cannot be used to probe which
        // addresses exist.
        const limit = await rateLimit("login", email);
        if (!limit.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
            deletedAt: true,
          },
        });

        // Google-only accounts have no passwordHash; still do the work.
        const valid = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);

        if (!user || !user.passwordHash || user.deletedAt || !valid) return null;

        await resetRateLimit("login", email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});
