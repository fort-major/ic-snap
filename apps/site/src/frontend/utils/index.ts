import { ActorSubclass } from "@dfinity/agent";
import { InternalSnapClient } from "@fort-major/masquerade-client";
import { Backend } from "../backend";
import { ErrorCode, err } from "@fort-major/masquerade-shared";
import { JSXElement, Setter } from "solid-js";

const ONE_DAY = 1000 * 60 * 60 * 24;

export async function handleStatistics(actor: ActorSubclass<Backend>, client: InternalSnapClient) {
  const stats = await client.getStats();
  const now = Date.now();

  if (stats.dev + stats.prod < 1000 || now - stats.lastResetTimestamp < ONE_DAY) return;

  await client.resetStats();

  await actor.increment_stats(BigInt(stats.dev), BigInt(stats.prod));
}

export function assertEventSafe(e: Event) {
  if (!e.isTrusted) {
    err(ErrorCode.SECURITY_VIOLATION, "No automation allowed!");
  }
}

export interface IChildren {
  children: JSXElement;
}

export const DUMMY_ACCESSOR = () => undefined;
export const DUMMY_SETTER = DUMMY_ACCESSOR;

export function timestampToStr(timestampMs: number) {
  const date = new Date(timestampMs);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
