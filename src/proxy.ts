import { clerkMiddleware } from "@clerk/nextjs/server";

// Oturum bilgisi her istekte çözülür; yetki kontrolü her sayfa (requireUser) ve API route'unda (auth/withUser) yapılır.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|sw\\.js|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
