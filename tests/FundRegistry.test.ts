import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_FUND_NOT_FOUND = 101;
const ERR_FUND_ALREADY_EXISTS = 102;
const ERR_INVALID_NAME = 103;
const ERR_INVALID_GOAL = 104;
const ERR_INVALID_STATUS = 105;
const ERR_INVALID_CREATOR = 106;
const ERR_INVALID_LOCATION = 107;
const ERR_INVALID_CURRENCY = 108;
const ERR_MAX_FUNDS_EXCEEDED = 110;
const ERR_REGISTRY_LOCKED = 111;

interface RegistryFund {
  name: string;
  goal: number;
  creator: string;
  location: string;
  currency: string;
  timestamp: number;
  active: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class FundRegistryMock {
  state: {
    nextFundId: number;
    maxFunds: number;
    registryLocked: boolean;
    fundsRegistry: Map<number, RegistryFund>;
    fundIdByName: Map<string, number>;
    fundNames: Map<number, string>;
  } = {
    nextFundId: 0,
    maxFunds: 1000,
    registryLocked: false,
    fundsRegistry: new Map(),
    fundIdByName: new Map(),
    fundNames: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextFundId: 0,
      maxFunds: 1000,
      registryLocked: false,
      fundsRegistry: new Map(),
      fundIdByName: new Map(),
      fundNames: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
  }

  registerFund(id: number, name: string, goal: number, creator: string): Result<boolean> {
    if (this.state.registryLocked) return { ok: false, value: ERR_REGISTRY_LOCKED };
    if (id !== this.state.nextFundId) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!name || name.length > 50) return { ok: false, value: ERR_INVALID_NAME };
    if (goal <= 0) return { ok: false, value: ERR_INVALID_GOAL };
    if (creator !== this.caller) return { ok: false, value: ERR_INVALID_CREATOR };
    if (this.state.fundIdByName.has(name)) return { ok: false, value: ERR_FUND_ALREADY_EXISTS };
    if (this.state.nextFundId >= this.state.maxFunds) return { ok: false, value: ERR_MAX_FUNDS_EXCEEDED };

    const fund: RegistryFund = {
      name,
      goal,
      creator,
      location: "",
      currency: "STX",
      timestamp: this.blockHeight,
      active: true,
    };
    this.state.fundsRegistry.set(id, fund);
    this.state.fundIdByName.set(name, id);
    this.state.fundNames.set(id, name);
    this.state.nextFundId++;
    return { ok: true, value: true };
  }

  updateFundMetadata(id: number, location: string, currency: string): Result<boolean> {
    const fund = this.state.fundsRegistry.get(id);
    if (!fund) return { ok: false, value: ERR_FUND_NOT_FOUND };
    if (fund.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!fund.active) return { ok: false, value: ERR_INVALID_STATUS };
    if (!location || location.length > 50) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };

    const updated: RegistryFund = { ...fund, location, currency };
    this.state.fundsRegistry.set(id, updated);
    return { ok: true, value: true };
  }

  deactivateFund(id: number): Result<boolean> {
    const fund = this.state.fundsRegistry.get(id);
    if (!fund) return { ok: false, value: ERR_FUND_NOT_FOUND };
    if (fund.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!fund.active) return { ok: false, value: ERR_INVALID_STATUS };

    const updated: RegistryFund = { ...fund, active: false };
    this.state.fundsRegistry.set(id, updated);
    return { ok: true, value: true };
  }

  reactivateFund(id: number): Result<boolean> {
    const fund = this.state.fundsRegistry.get(id);
    if (!fund) return { ok: false, value: ERR_FUND_NOT_FOUND };
    if (fund.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (fund.active) return { ok: false, value: ERR_INVALID_STATUS };

    const updated: RegistryFund = { ...fund, active: true };
    this.state.fundsRegistry.set(id, updated);
    return { ok: true, value: true };
  }

  lockRegistry(): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.registryLocked = true;
    return { ok: true, value: true };
  }

  setMaxFunds(newMax: number): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= this.state.nextFundId) return { ok: false, value: ERR_INVALID_GOAL };
    this.state.maxFunds = newMax;
    return { ok: true, value: true };
  }

  getFundById(id: number): RegistryFund | null {
    return this.state.fundsRegistry.get(id) || null;
  }

  getFundIdByName(name: string): number | null {
    return this.state.fundIdByName.get(name) || null;
  }

  getFundName(id: number): string | null {
    return this.state.fundNames.get(id) || null;
  }

  isFundRegistered(name: string): boolean {
    return this.state.fundIdByName.has(name);
  }

  getTotalFunds(): Result<number> {
    return { ok: true, value: this.state.nextFundId };
  }

  isRegistryLocked(): Result<boolean> {
    return { ok: true, value: this.state.registryLocked };
  }
}

describe("FundRegistry", () => {
  let contract: FundRegistryMock;

  beforeEach(() => {
    contract = new FundRegistryMock();
    contract.reset();
  });

  it("rejects duplicate fund name", () => {
    contract.registerFund(0, "Wellness2025", 50000, "ST1TEST");
    const result = contract.registerFund(1, "Wellness2025", 100000, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_FUND_ALREADY_EXISTS);
  });

  it("rejects invalid fund ID sequence", () => {
    const result = contract.registerFund(5, "Wellness2025", 50000, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid name", () => {
    const result = contract.registerFund(0, "", 50000, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NAME);
  });

  it("rejects zero goal", () => {
    const result = contract.registerFund(0, "Wellness2025", 0, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_GOAL);
  });

  it("updates fund metadata successfully", () => {
    contract.registerFund(0, "Wellness2025", 50000, "ST1TEST");
    const result = contract.updateFundMetadata(0, "Downtown Clinic", "BTC");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const fund = contract.getFundById(0);
    expect(fund?.location).toBe("Downtown Clinic");
    expect(fund?.currency).toBe("BTC");
  });

  it("rejects metadata update by non-creator", () => {
    contract.registerFund(0, "Wellness2025", 50000, "ST1TEST");
    contract.caller = "ST2OTHER";
    const result = contract.updateFundMetadata(0, "Downtown Clinic", "BTC");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("deactivates and reactivates fund", () => {
    contract.registerFund(0, "Wellness2025", 50000, "ST1TEST");
    const deactivate = contract.deactivateFund(0);
    expect(deactivate.ok).toBe(true);
    const fund = contract.getFundById(0);
    expect(fund?.active).toBe(false);

    const reactivate = contract.reactivateFund(0);
    expect(reactivate.ok).toBe(true);
    const updated = contract.getFundById(0);
    expect(updated?.active).toBe(true);
  });

it("sets max funds limit", () => {
    const result = contract.setMaxFunds(500);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxFunds).toBe(500);
  });

  it("rejects max funds below current count", () => {
    contract.registerFund(0, "Fund1", 10000, "ST1TEST");
    const result = contract.setMaxFunds(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_GOAL);
  });

  it("checks fund registration", () => {
    contract.registerFund(0, "Wellness2025", 50000, "ST1TEST");
    expect(contract.isFundRegistered("Wellness2025")).toBe(true);
    expect(contract.isFundRegistered("Unknown")).toBe(false);
  });

  it("returns total funds count", () => {
    contract.registerFund(0, "Fund1", 10000, "ST1TEST");
    contract.registerFund(1, "Fund2", 20000, "ST1TEST");
    const result = contract.getTotalFunds();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects registration when max funds exceeded", () => {
    contract.state.maxFunds = 1;
    contract.registerFund(0, "Fund1", 10000, "ST1TEST");
    const result = contract.registerFund(1, "Fund2", 20000, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_FUNDS_EXCEEDED);
  });
});