import type { NextRequest } from "next/server";

import { handleEmailLinkConfirmation } from "@/modules/identity/presentation/route-handlers";

export function GET(request: NextRequest) {
  return handleEmailLinkConfirmation(request);
}
