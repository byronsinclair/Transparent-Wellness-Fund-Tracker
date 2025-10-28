import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_EVENT = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_INVALID_FUND_ID = 103;
const ERR_INVALID_PRINCIPAL = 104;
const ERR_MAX_LOGS_EXCEEDED = 107;

interface EventLog {
  eventType: string;
  fundId: number;
  sender: string;
  amount: number;
  timestamp: number | null;
  blockHeight: number;
  txId: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class AuditLoggerMock {
  state: {
    logCounter: number;
    maxLogs: number;
    loggerAuthority: string;
    eventLogs: Map<number, EventLog>;
    logsByFund: Map<number, number[]>;
    logsBySender: Map<string, number[]>;
  } = {
    logCounter: 0,
    maxLogs: 10000,
    loggerAuthority: "ST1TEST",
    eventLogs: new Map(),
    logsByFund: new Map(),
    logsBySender: new Map(),
  };
  blockHeight: number = 100;
  caller: string = "ST1TEST";
  txId: string = "0x1234";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      logCounter: 0,
      maxLogs: 10000,
      loggerAuthority: "ST1TEST",
      eventLogs: new Map(),
      logsByFund: new Map(),
      logsBySender: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1TEST";
    this.txId = "0x1234";
  }

  logEvent(
    sender: string,
    eventType: string,
    fundId: number,
    amount: number
  ): Result<number> {
    if (
      this.caller !== this.state.loggerAuthority &&
      this.caller !== "contract"
    ) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.state.logCounter >= this.state.maxLogs) {
      return { ok: false, value: ERR_MAX_LOGS_EXCEEDED };
    }
    const validEvents = [
      "fund-created",
      "contribution",
      "proposal-submitted",
      "vote-cast",
      "disbursement",
      "fund-updated",
      "fund-closed",
    ];
    if (!validEvents.includes(eventType)) {
      return { ok: false, value: ERR_INVALID_EVENT };
    }
    if (amount < 0) {
      return { ok: false, value: ERR_INVALID_AMOUNT };
    }
    if (fundId < 0) {
      return { ok: false, value: ERR_INVALID_FUND_ID };
    }
    if (sender === this.caller) {
      return { ok: false, value: ERR_INVALID_PRINCIPAL };
    }

    const logId = this.state.logCounter;
    const log: EventLog = {
      eventType,
      fundId,
      sender,
      amount,
      timestamp: null,
      blockHeight: this.blockHeight,
      txId: this.txId,
    };
    this.state.eventLogs.set(logId, log);

    const fundLogs = this.state.logsByFund.get(fundId) || [];
    if (fundLogs.length >= 1000)
      return { ok: false, value: ERR_MAX_LOGS_EXCEEDED };
    this.state.logsByFund.set(fundId, [...fundLogs, logId]);

    const senderLogs = this.state.logsBySender.get(sender) || [];
    if (senderLogs.length >= 1000)
      return { ok: false, value: ERR_MAX_LOGS_EXCEEDED };
    this.state.logsBySender.set(sender, [...senderLogs, logId]);

    this.state.logCounter++;
    return { ok: true, value: logId };
  }

  setLoggerAuthority(newAuthority: string): Result<boolean> {
    if (this.caller !== this.state.loggerAuthority) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    this.state.loggerAuthority = newAuthority;
    return { ok: true, value: true };
  }

  setMaxLogs(newMax: number): Result<boolean> {
    if (this.caller !== this.state.loggerAuthority) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (newMax <= this.state.logCounter) {
      return { ok: false, value: ERR_INVALID_AMOUNT };
    }
    this.state.maxLogs = newMax;
    return { ok: true, value: true };
  }

  getLog(logId: number): EventLog | null {
    return this.state.eventLogs.get(logId) || null;
  }

  getLogsByFund(fundId: number, offset: number, limit: number): number[] {
    const ids = this.state.logsByFund.get(fundId) || [];
    return ids.slice(offset, offset + limit);
  }

  getLogsBySender(sender: string, offset: number, limit: number): number[] {
    const ids = this.state.logsBySender.get(sender) || [];
    return ids.slice(offset, offset + limit);
  }

  getTotalLogs(): Result<number> {
    return { ok: true, value: this.state.logCounter };
  }

  getAuthority(): Result<string> {
    return { ok: true, value: this.state.loggerAuthority };
  }

  getLogCountByFund(fundId: number): number {
    return (this.state.logsByFund.get(fundId) || []).length;
  }

  getLogCountBySender(sender: string): number {
    return (this.state.logsBySender.get(sender) || []).length;
  }
}

describe("AuditLogger", () => {
  let contract: AuditLoggerMock;

  beforeEach(() => {
    contract = new AuditLoggerMock();
    contract.reset();
  });

  it("logs contribution event successfully", () => {
    const result = contract.logEvent("ST2DONOR", "contribution", 0, 500);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const log = contract.getLog(0);
    expect(log?.eventType).toBe("contribution");
    expect(log?.fundId).toBe(0);
    expect(log?.sender).toBe("ST2DONOR");
    expect(log?.amount).toBe(500);
    expect(log?.blockHeight).toBe(100);
    expect(contract.getLogCountByFund(0)).toBe(1);
    expect(contract.getLogCountBySender("ST2DONOR")).toBe(1);
  });

  it("rejects unauthorized logger", () => {
    contract.caller = "ST3HACKER";
    const result = contract.logEvent("ST2DONOR", "contribution", 0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid event type", () => {
    const result = contract.logEvent("ST2DONOR", "invalid-event", 0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EVENT);
  });

  it("rejects self as sender", () => {
    const result = contract.logEvent("ST1TEST", "contribution", 0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRINCIPAL);
  });

  it("logs multiple events and retrieves by fund", () => {
    contract.logEvent("ST2A", "contribution", 1, 100);
    contract.logEvent("ST2B", "vote-cast", 1, 0);
    contract.logEvent("ST2C", "contribution", 2, 200);

    const logs = contract.getLogsByFund(1, 0, 2);
    expect(logs.length).toBe(2);
    expect(contract.getLogCountByFund(1)).toBe(2);
  });

  it("logs multiple events and retrieves by sender", () => {
    contract.logEvent("ST2USER", "contribution", 0, 100);
    contract.logEvent("ST2USER", "vote-cast", 1, 0);
    contract.logEvent("ST3OTHER", "disbursement", 0, 50);

    const logs = contract.getLogsBySender("ST2USER", 0, 2);
    expect(logs.length).toBe(2);
    expect(contract.getLogCountBySender("ST2USER")).toBe(2);
  });

  it("enforces max logs limit", () => {
    contract.state.maxLogs = 1;
    contract.logEvent("ST2A", "contribution", 0, 100);
    const result = contract.logEvent("ST2B", "contribution", 1, 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_LOGS_EXCEEDED);
  });

  it("updates logger authority", () => {
    const result = contract.setLoggerAuthority("ST2NEW");
    expect(result.ok).toBe(true);
    expect(contract.getAuthority().value).toBe("ST2NEW");

    contract.caller = "ST2NEW";
    const logResult = contract.logEvent("ST3DONOR", "fund-created", 0, 0);
    expect(logResult.ok).toBe(true);
  });

  it("rejects authority update by non-owner", () => {
    contract.caller = "ST3HACKER";
    const result = contract.setLoggerAuthority("ST3HACKER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets max logs limit", () => {
    const result = contract.setMaxLogs(5000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxLogs).toBe(5000);
  });

  it("rejects max logs below current count", () => {
    contract.logEvent("ST2A", "contribution", 0, 100);
    const result = contract.setMaxLogs(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("returns total logs count", () => {
    contract.logEvent("ST2A", "contribution", 0, 100);
    contract.logEvent("ST2B", "vote-cast", 1, 0);
    const result = contract.getTotalLogs();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("allows contract self-call to log", () => {
    contract.caller = "contract";
    const result = contract.logEvent("ST2DONOR", "fund-created", 0, 0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
  });
});
