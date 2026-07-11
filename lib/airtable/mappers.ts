import type Airtable from "airtable";
import type { ContractYearTerm, Player, Team } from "@/lib/dues/types";
import { FIELDS } from "./schema";

type AirtableRecord = Airtable.Record<Airtable.FieldSet>;

/** Airtable date fields may include a time component; normalize to YYYY-MM-DD for comparison. */
function toDateOnly(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function toLinkedIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function firstLinkedId(value: unknown): string {
  return toLinkedIds(value)[0] ?? "";
}

export function mapTeam(record: AirtableRecord): Team {
  return {
    id: record.id,
    name: String(record.get(FIELDS.teams.name) ?? ""),
    payPeriodsPerYear: Number(record.get(FIELDS.teams.payPeriodsPerYear) ?? 0),
    payrollCycle: String(record.get(FIELDS.teams.payrollCycle) ?? ""),
  };
}

export function mapPlayer(record: AirtableRecord): Player {
  return {
    id: record.id,
    name: String(record.get(FIELDS.players.name) ?? ""),
  };
}

export function mapContractYearTerm(record: AirtableRecord): ContractYearTerm {
  return {
    id: record.id,
    startDate: toDateOnly(record.get(FIELDS.contractYearTerms.startDate)),
    endDate: toDateOnly(record.get(FIELDS.contractYearTerms.endDate)),
    baseCompensation: Number(record.get(FIELDS.contractYearTerms.baseCompensation) ?? 0),
  };
}

export interface RawContractTerm {
  id: string;
  startDate: string;
  endDate: string;
  yearTermIds: string[];
}

export function mapContractTermRaw(record: AirtableRecord): RawContractTerm {
  return {
    id: record.id,
    startDate: toDateOnly(record.get(FIELDS.contractTerms.startDate)),
    endDate: toDateOnly(record.get(FIELDS.contractTerms.endDate)),
    yearTermIds: toLinkedIds(record.get(FIELDS.contractTerms.contractYearTerms)),
  };
}

export interface RawContract {
  id: string;
  playerId: string;
  teamId: string;
  effectiveDate: string;
  contractEndDate: string;
  duesAuthorization: boolean;
  duesPercent: number;
  termIds: string[];
}

export function mapContractRaw(record: AirtableRecord): RawContract {
  return {
    id: record.id,
    playerId: firstLinkedId(record.get(FIELDS.contracts.player)),
    teamId: firstLinkedId(record.get(FIELDS.contracts.team)),
    effectiveDate: toDateOnly(record.get(FIELDS.contracts.effectiveDate)),
    contractEndDate: toDateOnly(record.get(FIELDS.contracts.contractEndDate)),
    duesAuthorization: Boolean(record.get(FIELDS.contracts.duesAuthorization)),
    duesPercent: Number(record.get(FIELDS.contracts.dues) ?? 0),
    termIds: toLinkedIds(record.get(FIELDS.contracts.contractTerms)),
  };
}
