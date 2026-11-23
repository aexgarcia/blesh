import type { NextRequest } from "next/server";

import { adminSessionProxy } from "@/modules/identity/presentation/proxy-session";

export function proxy(request: NextRequest) {
  return adminSessionProxy(request);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
