import "server-only";
import { auth } from "@clerk/nextjs/server";
import { requireUser } from "./auth";

type User = Awaited<ReturnType<typeof requireUser>>;

/** Mobil API için: Clerk oturum token'ı (Authorization: Bearer) ile kullanıcıyı çözer. */
export function withUser<C>(handler: (user: User, req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    const user = await requireUser();
    const data = await handler(user, req, ctx);
    return data instanceof Response ? data : Response.json(data);
  };
}
