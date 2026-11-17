import { config } from "../config";
import { DomainError } from "../domain/context";
import { maskPhone } from "./phone";

/**
 * Sends a text message. "console" only logs (local development; refused with live funds by config validation).
 * "africastalking" calls Africa's Talking's messaging API. Never log message bodies: they contain codes.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  const { sms } = config();
  if (sms.provider === "console") {
    console.log(`[sms:dev] to ${maskPhone(to)}: ${message}`);
    return;
  }
  const host = sms.atUsername === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const body = new URLSearchParams({ username: sms.atUsername, to, message });
  if (sms.atSenderId) body.set("from", sms.atSenderId);
  let res: Response;
  try {
    res = await fetch(`https://${host}/version1/messaging`, {
      method: "POST",
      headers: { apiKey: sms.atApiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new DomainError("SMS_FAILED", "We could not send the code. Please try again.", 502, true);
  }
  if (!res.ok) {
    console.warn(`[sms] provider returned HTTP ${res.status} for ${maskPhone(to)}`);
    throw new DomainError("SMS_FAILED", "We could not send the code. Please try again.", 502, true);
  }
  const data = (await res.json().catch(() => null)) as { SMSMessageData?: { Recipients?: { statusCode?: number }[] } } | null;
  const code = data?.SMSMessageData?.Recipients?.[0]?.statusCode;
  // 100 Processed, 101 Sent, 102 Queued.
  if (code !== undefined && ![100, 101, 102].includes(code)) {
    console.warn(`[sms] provider rejected message to ${maskPhone(to)} with status ${code}`);
    throw new DomainError("SMS_FAILED", "We could not send the code to that number.", 502, true);
  }
}
