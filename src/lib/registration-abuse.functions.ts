import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WINDOW_15_MIN = 15 * 60 * 1000;
const WINDOW_24_HOURS = 24 * 60 * 60 * 1000;
const WINDOW_DEVICE_HISTORY = 365 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS_15_MIN = 5;
const MAX_REGISTERED_PER_IP_24H = 3;

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function cleanHeader(value: string | null, max = 256) {
  const cleaned = value?.trim().replace(/[\r\n]/g, "");
  return cleaned ? cleaned.slice(0, max) : "unknown";
}

function requestIp() {
  const request = getRequest();
  const headers = request?.headers;
  if (!headers) return "unknown";

  const cf = cleanHeader(headers.get("cf-connecting-ip"), 64);
  if (cf !== "unknown") return cf;

  const forwarded = cleanHeader(headers.get("x-forwarded-for"), 256);
  if (forwarded !== "unknown") return forwarded.split(",")[0]?.trim().slice(0, 64) || "unknown";

  return cleanHeader(headers.get("x-real-ip"), 64);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function salt() {
  const explicit = process.env["REGISTRATION_ABUSE_SALT"]?.trim();
  if (explicit) return explicit;
  const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!serviceRole) throw new Error("Proteção de cadastro indisponível no momento.");
  return serviceRole;
}

async function privateHash(kind: string, value: string) {
  return sha256(`${salt()}::${kind}::${value}`);
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type EventRow = {
  id: string;
  created_at: string;
  status: "attempt" | "registered" | "failed";
  user_id: string | null;
  email_hash: string;
  ip_hash: string;
  device_hash: string;
};

async function recentBy(column: "device_hash" | "ip_hash", value: string, since: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("registration_abuse_events")
    .select("id,created_at,status,user_id,email_hash,ip_hash,device_hash")
    .eq(column, value)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Proteção de cadastro indisponível: ${error.message}`);
  return (data ?? []) as EventRow[];
}

export const checkRegistrationAbuse = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    email: z.string().trim().email().max(254),
    deviceId: z.string().trim().min(16).max(128),
  }).parse(data))
  .handler(async ({ data }) => {
    const now = Date.now();
    const since15 = new Date(now - WINDOW_15_MIN).toISOString();
    const since24 = new Date(now - WINDOW_24_HOURS).toISOString();
    const sinceDeviceHistory = new Date(now - WINDOW_DEVICE_HISTORY).toISOString();
    const email = normalizedEmail(data.email);
    const ip = requestIp();
    const hasReliableIp = ip !== "unknown";
    const request = getRequest();
    const userAgent = cleanHeader(request?.headers?.get("user-agent") ?? null, 512);

    const [emailHash, ipHash, deviceHash, userAgentHash] = await Promise.all([
      privateHash("email", email),
      privateHash("ip", ip),
      privateHash("device", data.deviceId),
      privateHash("ua", userAgent),
    ]);

    const deviceHistoryPromise = recentBy("device_hash", deviceHash, sinceDeviceHistory);
    const device15Promise = recentBy("device_hash", deviceHash, since15);
    const ip24Promise = hasReliableIp ? recentBy("ip_hash", ipHash, since24) : Promise.resolve([] as EventRow[]);
    const ip15Promise = hasReliableIp ? recentBy("ip_hash", ipHash, since15) : Promise.resolve([] as EventRow[]);
    const [deviceHistory, ip24, device15, ip15] = await Promise.all([
      deviceHistoryPromise,
      ip24Promise,
      device15Promise,
      ip15Promise,
    ]);

    const registeredOnDevice = deviceHistory.find((row) => row.status === "registered" && row.email_hash !== emailHash);
    if (registeredOnDevice) {
      return {
        allowed: false as const,
        code: "device_already_registered" as const,
        message: "Este aparelho já foi usado para criar outra conta. Entre na conta existente ou fale com o suporte.",
      };
    }

    const registeredOnIp = ip24.filter((row) => row.status === "registered");
    const distinctUsersOnIp = new Set(registeredOnIp.map((row) => row.user_id).filter(Boolean));
    if (hasReliableIp && distinctUsersOnIp.size >= MAX_REGISTERED_PER_IP_24H) {
      return {
        allowed: false as const,
        code: "ip_registration_limit" as const,
        message: "Muitas contas foram criadas recentemente nesta conexão. Tente mais tarde ou fale com o suporte.",
      };
    }

    if (device15.length >= MAX_ATTEMPTS_15_MIN || (hasReliableIp && ip15.length >= MAX_ATTEMPTS_15_MIN * 2)) {
      return {
        allowed: false as const,
        code: "too_many_attempts" as const,
        message: "Foram feitas muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
      };
    }

    const reservationToken = randomToken();
    const reservationTokenHash = await privateHash("reservation", reservationToken);
    const { error } = await (supabaseAdmin as any).from("registration_abuse_events").insert({
      status: "attempt",
      email_hash: emailHash,
      ip_hash: ipHash,
      device_hash: deviceHash,
      user_agent_hash: userAgentHash,
      reservation_token_hash: reservationTokenHash,
    });
    if (error) throw new Error(`Não foi possível validar o cadastro: ${error.message}`);

    return { allowed: true as const, reservationToken };
  });

export const confirmRegistrationAbuse = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    reservationToken: z.string().regex(/^[a-f0-9]{64}$/),
    userId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data }) => {
    const reservationTokenHash = await privateHash("reservation", data.reservationToken);
    const cutoff = new Date(Date.now() - WINDOW_24_HOURS).toISOString();
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("registration_abuse_events")
      .update({ status: "registered", user_id: data.userId, updated_at: new Date().toISOString() })
      .eq("reservation_token_hash", reservationTokenHash)
      .eq("status", "attempt")
      .gte("created_at", cutoff)
      .select("id");

    if (error) throw new Error(`Não foi possível concluir a proteção do cadastro: ${error.message}`);
    return { ok: Array.isArray(rows) && rows.length === 1 };
  });
