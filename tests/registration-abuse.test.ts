import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const guard = readFileSync("src/lib/registration-abuse.functions.ts", "utf8");
const auth = readFileSync("src/routes/auth.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260903121500_registration_abuse_guard.sql", "utf8");

describe("proteção antiabuso de cadastro", () => {
  test("não armazena IP, e-mail ou aparelho em texto puro", () => {
    expect(guard).toContain('privateHash("email"');
    expect(guard).toContain('privateHash("ip"');
    expect(guard).toContain('privateHash("device"');
    expect(migration).toContain("email_hash text not null");
    expect(migration).toContain("ip_hash text not null");
    expect(migration).toContain("device_hash text not null");
    expect(migration).not.toContain("ip_address");
  });

  test("mesmo aparelho bloqueia uma segunda conta e IP aplica limite de abuso", () => {
    expect(guard).toContain('code: "device_already_registered"');
    expect(guard).toContain('code: "ip_registration_limit"');
    expect(guard).toContain("MAX_REGISTERED_PER_IP_24H = 3");
    expect(guard).toContain("MAX_ATTEMPTS_15_MIN = 5");
  });

  test("cadastro por senha passa pela reserva e confirmação", () => {
    expect(auth).toContain("reserveRegistration(email)");
    expect(auth).toContain("confirmRegistration({ data: { reservationToken, userId: data.user.id } })");
    expect(auth).toContain("REGISTRATION_DEVICE_ID");
  });

  test("Google não encerra uma sessão local antes de iniciar o OAuth", () => {
    const handleGoogle = auth.slice(auth.indexOf("async function handleGoogle"), auth.indexOf("async function routeGoogleUser"));
    expect(handleGoogle).not.toContain('signOut({ scope: "local" })');
    expect(auth).toContain("confirmReservedRegistration(userId, googleEmail)");
  });
});
