import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_FUND_NOT_FOUND = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_FUND_ALREADY_EXISTS = 103;
const ERR_INVALID_NAME = 104;
const ERR_INVALID_GOAL = 105;
const ERR_INVALID_DURATION = 106;
const ERR_INVALID_THRESHOLD = 107;
const ERR_INVALID_STATUS = 108;
const ERR_INVALID_CURRENCY = 110;
const ERR_INVALID_LOCATION = 111;
const ERR_INVALID_MIN_CONTRIB = 112;
const ERR_INVALID_MAX_CONTRIB = 113;
const ERR_INVALID_REWARD_RATE = 114;
const ERR_INVALID_PENALTY = 115;
const ERR_MAX_FUNDS_EXCEEDED = 116;
const ERR_INVALID_UPDATE_PARAM = 118;
const ERR_AUTHORITY_NOT_SET = 119;

interface Fund {
  name: string;
  goal: number;
  duration: number;
  threshold: number;
  balance: number;
  totalContributed: number;
  timestamp: number;
  creator: string;
  currency: string;
  location: string;
  status: boolean;
  minContrib: number;
  maxContrib: number;
  rewardRate: number;
  penalty: number;
}

interface FundUpdate {
  updateName: string;
  updateGoal: number;
  updateDuration: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class WellnessFundMock {
  state: {
    nextFundId: number;
    maxFunds: number;
    creationFee: number;
    authority: string | null;
    funds: Map<number, Fund>;
    fundUpdates: Map<number, FundUpdate>;
    fundsByName: Map<string, number>;
  } = {
    nextFundId: 0,
    maxFunds: 500,
    creationFee: 500,
    authority: null,
    funds: new Map(),
    fundUpdates: new Map(),
    fundsByName: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  logs: Array<{ sender: string; event: string; fundId: number; amount: number }> = [];
  mints: Array<{ recipient: string; amount: number }> = [];
  registryCalls: Array<{ id: number; name: string; goal: number; creator: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextFundId: 0,
      maxFunds: 500,
      creationFee: 500,
      authority: null,
      funds: new Map(),
      fundUpdates: new Map(),
      fundsByName: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.logs = [];
    this.mints = [];
    this.registryCalls = [];
  }

  setAuthority(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.authority !== null) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    this.state.authority = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxFunds(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (!this.state.authority) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    this.state.maxFunds = newMax;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (!this.state.authority) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createFund(
    name: string,
    goal: number,
    duration: number,
    threshold: number,
    currency: string,
    location: string,
    minContrib: number,
    maxContrib: number,
    rewardRate: number,
    penalty: number
  ): Result<number> {
    if (this.state.nextFundId >= this.state.maxFunds) return { ok: false, value: ERR_MAX_FUNDS_EXCEEDED };
    if (!name || name.length > 50) return { ok: false, value: ERR_INVALID_NAME };
    if (goal <= 0) return { ok: false, value: ERR_INVALID_GOAL };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (threshold <= 0 || threshold > 100) return { ok: false, value: ERR_INVALID_THRESHOLD };
    if (!["STX", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!location || location.length > 50) return { ok: false, value: ERR_INVALID_LOCATION };
    if (minContrib <= 0) return { ok: false, value: ERR_INVALID_MIN_CONTRIB };
    if (maxContrib <= 0) return { ok: false, value: ERR_INVALID_MAX_CONTRIB };
    if (rewardRate > 50) return { ok: false, value: ERR_INVALID_REWARD_RATE };
    if (penalty > 20) return { ok: false, value: ERR_INVALID_PENALTY };
    if (this.state.fundsByName.has(name)) return { ok: false, value: ERR_FUND_ALREADY_EXISTS };
    if (!this.state.authority) return { ok: false, value: ERR_AUTHORITY_NOT_SET };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authority });
    const id = this.state.nextFundId;
    const fund: Fund = {
      name,
      goal,
      duration,
      threshold,
      balance: 0,
      totalContributed: 0,
      timestamp: this.blockHeight,
      creator: this.caller,
      currency,
      location,
      status: true,
      minContrib,
      maxContrib,
      rewardRate,
      penalty,
    };
    this.state.funds.set(id, fund);
    this.state.fundsByName.set(name, id);
    this.registryCalls.push({ id, name, goal, creator: this.caller });
    this.logs.push({ sender: this.caller, event: "fund-created", fundId: id, amount: 0 });
    this.state.nextFundId++;
    return { ok: true, value: id };
  }

  contribute(fundId: number, amount: number): Result<number> {
    const fund = this.state.funds.get(fundId);
    if (!fund) return { ok: false, value: ERR_FUND_NOT_FOUND };
    if (!fund.status) return { ok: false, value: ERR_INVALID_STATUS };
    if (amount < fund.minContrib || amount > fund.maxContrib) return { ok: false, value: ERR_INVALID_AMOUNT };

    this.stxTransfers.push({ amount, from: this.caller, to: null });
    const newBalance = fund.balance + amount;
    const newTotal = fund.totalContributed + amount;
    const reward = Math.floor((amount * fund.rewardRate) / 100);
    const updated: Fund = { ...fund, balance: newBalance, totalContributed: newTotal };
    this.state.funds.set(fundId, updated);
    this.mints.push({ recipient: this.caller, amount: reward });
    this.logs.push({ sender: this.caller, event: "contribution", fundId, amount });
    return { ok: true, value: newBalance };
  }

  getFund(id: number): Fund | null {
    return this.state.funds.get(id) || null;
  }

  updateFund(id: number, updateName: string, updateGoal: number, updateDuration: number): Result<boolean> {
    const fund = this.state.funds.get(id);
    if (!fund) return { ok: false, value: ERR_FUND_NOT_FOUND };
    if (fund.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!updateName || updateName.length > 50) return { ok: false, value: ERR_INVALID_NAME };
    if (updateGoal <= 0) return { ok: false, value: ERR_INVALID_GOAL };
    if (updateDuration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (this.state.fundsByName.has(updateName) && this.state.fundsByName.get(updateName) !== id) {
      return { ok: false, value: ERR_FUND_ALREADY_EXISTS };
    }

    const updated: Fund = {
      ...fund,
      name: updateName,
      goal: updateGoal,
      duration: updateDuration,
      timestamp: this.blockHeight,
    };
    this.state.funds.set(id, updated);
    this.state.fundsByName.delete(fund.name);
    this.state.fundsByName.set(updateName, id);
    this.state.fundUpdates.set(id, {
      updateName,
      updateGoal,
      updateDuration,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  closeFund(id: number): Result<boolean> {
    const fund = this.state.funds.get(id);
    if (!fund) return { ok: false, value: ERR_FUND_NOT_FOUND };
    if (fund.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!fund.status) return { ok: false, value: ERR_INVALID_STATUS };

    const updated: Fund = { ...fund, status: false };
    this.state.funds.set(id, updated);
    return { ok: true, value: true };
  }

  getFundCount(): Result<number> {
    return { ok: true, value: this.state.nextFundId };
  }
}

describe("WellnessFund", () => {
  let contract: WellnessFundMock;

  beforeEach(() => {
    contract = new WellnessFundMock();
    contract.reset();
  });

  it("creates a fund successfully", () => {
    contract.setAuthority("ST2TEST");
    const result = contract.createFund(
      "HealthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const fund = contract.getFund(0);
    expect(fund?.name).toBe("HealthFund");
    expect(fund?.goal).toBe(10000);
    expect(fund?.duration).toBe(365);
    expect(fund?.threshold).toBe(75);
    expect(fund?.balance).toBe(0);
    expect(fund?.totalContributed).toBe(0);
    expect(fund?.currency).toBe("STX");
    expect(fund?.location).toBe("CityA");
    expect(fund?.minContrib).toBe(100);
    expect(fund?.maxContrib).toBe(1000);
    expect(fund?.rewardRate).toBe(10);
    expect(fund?.penalty).toBe(5);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
    expect(contract.registryCalls).toEqual([{ id: 0, name: "HealthFund", goal: 10000, creator: "ST1TEST" }]);
    expect(contract.logs).toEqual([{ sender: "ST1TEST", event: "fund-created", fundId: 0, amount: 0 }]);
  });

  it("rejects duplicate fund names", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "HealthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    const result = contract.createFund(
      "HealthFund",
      20000,
      730,
      80,
      "BTC",
      "CityB",
      200,
      2000,
      15,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_FUND_ALREADY_EXISTS);
  });

  it("rejects fund creation without authority", () => {
    const result = contract.createFund(
      "NoAuthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_SET);
  });

  it("rejects invalid name", () => {
    contract.setAuthority("ST2TEST");
    const result = contract.createFund(
      "",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NAME);
  });

  it("contributes successfully", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "HealthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    const result = contract.contribute(0, 500);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(500);

    const fund = contract.getFund(0);
    expect(fund?.balance).toBe(500);
    expect(fund?.totalContributed).toBe(500);
    expect(contract.stxTransfers.length).toBe(2);
    expect(contract.stxTransfers[1]).toEqual({ amount: 500, from: "ST1TEST", to: null });
    expect(contract.mints).toEqual([{ recipient: "ST1TEST", amount: 50 }]);
    expect(contract.logs[1]).toEqual({ sender: "ST1TEST", event: "contribution", fundId: 0, amount: 500 });
  });

  it("rejects invalid contribution amount", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "HealthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    const result = contract.contribute(0, 50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("updates fund successfully", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "OldFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    const result = contract.updateFund(0, "NewFund", 15000, 730);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const fund = contract.getFund(0);
    expect(fund?.name).toBe("NewFund");
    expect(fund?.goal).toBe(15000);
    expect(fund?.duration).toBe(730);
    const update = contract.state.fundUpdates.get(0);
    expect(update?.updateName).toBe("NewFund");
    expect(update?.updateGoal).toBe(15000);
    expect(update?.updateDuration).toBe(730);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update by non-creator", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "HealthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateFund(0, "NewFund", 15000, 730);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("closes fund successfully", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "HealthFund",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    const result = contract.closeFund(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const fund = contract.getFund(0);
    expect(fund?.status).toBe(false);
  });

  it("rejects close on non-existent fund", () => {
    contract.setAuthority("ST2TEST");
    const result = contract.closeFund(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_FUND_NOT_FOUND);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthority("ST2TEST");
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
  });

  it("returns correct fund count", () => {
    contract.setAuthority("ST2TEST");
    contract.createFund(
      "Fund1",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    contract.createFund(
      "Fund2",
      20000,
      730,
      80,
      "BTC",
      "CityB",
      200,
      2000,
      15,
      10
    );
    const result = contract.getFundCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects fund creation with max funds exceeded", () => {
    contract.setAuthority("ST2TEST");
    contract.state.maxFunds = 1;
    contract.createFund(
      "Fund1",
      10000,
      365,
      75,
      "STX",
      "CityA",
      100,
      1000,
      10,
      5
    );
    const result = contract.createFund(
      "Fund2",
      20000,
      730,
      80,
      "BTC",
      "CityB",
      200,
      2000,
      15,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_FUNDS_EXCEEDED);
  });
});