// Sincronização manual das migrations mais recentes sobre o snapshot gerado pelo Supabase.
// Remover este arquivo quando `supabase gen types` for executado novamente contra o banco atualizado.
import type { Database as GeneratedDatabase } from "./types";

type GeneratedPublic = GeneratedDatabase["public"];
type GeneratedLicense = GeneratedPublic["Tables"]["licenses"];

type LicenseTable = {
  Row: GeneratedLicense["Row"] & { ai_credits_used: number };
  Insert: GeneratedLicense["Insert"] & { ai_credits_used?: number };
  Update: GeneratedLicense["Update"] & { ai_credits_used?: number };
  Relationships: GeneratedLicense["Relationships"];
};

type ListingQuotaClaimsTable = {
  Row: {
    listing_id: string;
    user_id: string;
    created_at: string;
  };
  Insert: {
    listing_id: string;
    user_id: string;
    created_at?: string;
  };
  Update: {
    listing_id?: string;
    user_id?: string;
    created_at?: string;
  };
  Relationships: [];
};

type ManualTables = Omit<GeneratedPublic["Tables"], "licenses"> & {
  licenses: LicenseTable;
  listing_quota_claims: ListingQuotaClaimsTable;
};

type ManualFunctions = GeneratedPublic["Functions"] & {
  claim_listing_quota: {
    Args: { _user_id: string; _listing_id: string };
    Returns: boolean;
  };
  ai_credit_status: {
    Args: { p_user_id: string };
    Returns: {
      used: number;
      credit_limit: number;
      remaining: number;
    }[];
  };
};

type ManualEnums = Omit<GeneratedPublic["Enums"], "plan_kind"> & {
  plan_kind:
    | GeneratedPublic["Enums"]["plan_kind"]
    | "ai_package";
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublic, "Tables" | "Functions" | "Enums"> & {
    Tables: ManualTables;
    Functions: ManualFunctions;
    Enums: ManualEnums;
  };
};
