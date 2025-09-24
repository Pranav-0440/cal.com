import type { NextApiRequest } from "next";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import handleNewBooking from "@calcom/features/bookings/lib/handleNewBooking";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import getIP from "@calcom/lib/getIP";
import { piiHasher } from "@calcom/lib/server/PiiHasher";
import { checkCfTurnstileToken } from "@calcom/lib/server/checkCfTurnstileToken";
import { defaultResponder } from "@calcom/lib/server/defaultResponder";
import type { TraceContext } from "@calcom/lib/tracing";
import { distributedTracing } from "@calcom/lib/tracing/factory";
import { CreationSource } from "@calcom/prisma/enums";

async function handler(req: NextApiRequest & { userId?: number; traceContext: TraceContext }) {
  const userIp = getIP(req);

  const traceContext = distributedTracing.updateTrace(req.traceContext, {
    eventTypeId: req.body?.eventTypeId?.toString() || "null",
  });
  const tracingLogger = distributedTracing.getTracingLogger(traceContext);

  tracingLogger.info("API book event request started", {
    eventTypeId: req.body?.eventTypeId,
  });

  if (process.env.NEXT_PUBLIC_CLOUDFLARE_USE_TURNSTILE_IN_BOOKER === "1") {
    await checkCfTurnstileToken({
      token: req.body["cfToken"] as string,
      remoteIp: userIp,
    });
  }

  await checkRateLimitAndThrowError({
    rateLimitingType: "core",
    identifier: piiHasher.hash(userIp),
  });

  const session = await getServerSession({ req });
  /* To mimic API behavior and comply with types */
  req.body = {
    ...req.body,
    creationSource: CreationSource.WEBAPP,
  };

  const booking = await handleNewBooking({
    bookingData: req.body,
    userId: session?.user?.id || -1,
    hostname: req.headers.host || "",
    forcedSlug: req.headers["x-cal-force-slug"] as string | undefined,
    traceContext,
  });

  tracingLogger.info("API book event request completed successfully", {
    bookingUid: booking?.uid,
  });
  // const booking = await createBookingThroughFactory();
  return booking;

  //  To be added in the follow-up PR
  // async function createBookingThroughFactory() {
  //   console.log("Creating booking through factory");
  //   const regularBookingService = getRegularBookingService();

  //   const booking = await regularBookingService.createBooking({
  //     bookingData: req.body,
  //     bookingMeta: {
  //       userId: session?.user?.id || -1,
  //       hostname: req.headers.host || "",
  //       forcedSlug: req.headers["x-cal-force-slug"] as string | undefined,
  //     },
  //   });
  //   return booking;
  // }
}

export default defaultResponder(handler, "/api/book/event");
