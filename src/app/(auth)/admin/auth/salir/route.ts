import type { NextRequest } from "next/server";

import { handleForcedSignOut } from "@/modules/identity/presentation/route-handlers";

export function GET(request: NextRequest) {
  return handleForcedSignOut(request);
}
