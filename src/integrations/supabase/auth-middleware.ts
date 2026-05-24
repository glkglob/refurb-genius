// TanStack Start middleware that validates a Bearer token and injects
// an authenticated Supabase client + user into the middleware context.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifyToken } from "@repo/supabase/server";
import type { Database } from "./types";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Response("Unauthorized: No request headers available", { status: 401 });
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Response("Unauthorized: No authorization header provided", { status: 401 });
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Response("Unauthorized: Only Bearer tokens are supported", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Response("Unauthorized: No token provided", { status: 401 });
    }

    try {
      const { supabase, userId, user } = await verifyToken<Database>(token);
      return next({
        context: {
          supabase,
          userId,
          claims: user,
        },
      });
    } catch {
      throw new Response("Unauthorized: Invalid token", { status: 401 });
    }
  },
);
