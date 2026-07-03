import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  treasuryAccountsTable,
  treasuryTransactionsTable,
  treasurySessionsTable,
  usersTable,
} from "@workspace/db";
import {
  ListTreasuryTransactionsQueryParams,
  ListTreasurySessionsQueryParams,
  OpenTreasurySessionBody,
  GetCurrentTreasurySessionQueryParams,
  CloseTreasurySessionBody,
} from "@workspace/api-zod";
import { writeAuditLog } from "../lib/audit";
import { ensureStoreFinancials } from "../lib/seed";
import { money, toNum } from "../lib/money";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();

const DIRECTIONS = ["IN", "OUT"] as const;
const REF_TYPES = [
  "SALE",
  "SALES_RETURN",
  "PURCHASE",
  "PURCHASE_RETURN",
  "EXPENSE",
  "SALARY",
  "WITHDRAWAL",
  "DEPOSIT",
  "CUSTOMER_PAYMENT",
  "SUPPLIER_PAYMENT",
  "OPENING",
] as const;
const SESSION_STATUSES = ["OPEN", "CLOSED"] as const;

type Direction = (typeof DIRECTIONS)[number];
type RefType = (typeof REF_TYPES)[number];
type SessionStatus = (typeof SESSION_STATUSES)[number];

function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

// GET /treasury/accounts — drawers with cached balances (auto-seeds defaults)
router.get(
  "/treasury/accounts",
  requireAuth,
  requirePermission("treasury.view"),
  async (req, res) => {
    const storeId = req.auth!.storeId;
    await ensureStoreFinancials(db, storeId);
    const rows = await db
      .select({
        id: treasuryAccountsTable.id,
        type: treasuryAccountsTable.type,
        name: treasuryAccountsTable.name,
        balance: treasuryAccountsTable.balance,
        isActive: treasuryAccountsTable.isActive,
      })
      .from(treasuryAccountsTable)
      .where(eq(treasuryAccountsTable.storeId, storeId))
      .orderBy(treasuryAccountsTable.type);
    res.json(rows);
  },
);

// GET /treasury/transactions — immutable money ledger
router.get(
  "/treasury/transactions",
  requireAuth,
  requirePermission("treasury.view"),
  async (req, res) => {
    const parsed = ListTreasuryTransactionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "معاملات غير صالحة" });
      return;
    }
    const { page, pageSize, treasuryAccountId, direction, referenceType, dateFrom, dateTo } =
      parsed.data;
    const storeId = req.auth!.storeId;

    const conditions = [eq(treasuryTransactionsTable.storeId, storeId)];
    if (treasuryAccountId) {
      conditions.push(eq(treasuryTransactionsTable.treasuryAccountId, treasuryAccountId));
    }
    if (direction) {
      if (!(DIRECTIONS as readonly string[]).includes(direction)) {
        res.status(400).json({ error: "اتجاه غير صالح" });
        return;
      }
      conditions.push(eq(treasuryTransactionsTable.direction, direction as Direction));
    }
    if (referenceType) {
      if (!(REF_TYPES as readonly string[]).includes(referenceType)) {
        res.status(400).json({ error: "نوع مرجع غير صالح" });
        return;
      }
      conditions.push(eq(treasuryTransactionsTable.referenceType, referenceType as RefType));
    }
    if (dateFrom) conditions.push(gte(treasuryTransactionsTable.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(treasuryTransactionsTable.createdAt, new Date(dateTo)));
    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(treasuryTransactionsTable)
      .where(where);

    const rows = await db
      .select({
        id: treasuryTransactionsTable.id,
        treasuryAccountId: treasuryTransactionsTable.treasuryAccountId,
        accountName: treasuryAccountsTable.name,
        sessionId: treasuryTransactionsTable.sessionId,
        direction: treasuryTransactionsTable.direction,
        amount: treasuryTransactionsTable.amount,
        balanceAfter: treasuryTransactionsTable.balanceAfter,
        referenceType: treasuryTransactionsTable.referenceType,
        referenceId: treasuryTransactionsTable.referenceId,
        description: treasuryTransactionsTable.description,
        userName: usersTable.fullName,
        createdAt: treasuryTransactionsTable.createdAt,
      })
      .from(treasuryTransactionsTable)
      .leftJoin(
        treasuryAccountsTable,
        eq(treasuryTransactionsTable.treasuryAccountId, treasuryAccountsTable.id),
      )
      .leftJoin(usersTable, eq(treasuryTransactionsTable.createdBy, usersTable.id))
      .where(where)
      .orderBy(desc(treasuryTransactionsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total: count,
      page,
      pageSize,
    });
  },
);

// GET /treasury/sessions — shift history
router.get(
  "/treasury/sessions",
  requireAuth,
  requirePermission("treasury.view"),
  async (req, res) => {
    const parsed = ListTreasurySessionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "معاملات غير صالحة" });
      return;
    }
    const { page, pageSize, treasuryAccountId, status } = parsed.data;
    const storeId = req.auth!.storeId;

    const conditions = [eq(treasurySessionsTable.storeId, storeId)];
    if (treasuryAccountId) {
      conditions.push(eq(treasurySessionsTable.treasuryAccountId, treasuryAccountId));
    }
    if (status) {
      if (!(SESSION_STATUSES as readonly string[]).includes(status)) {
        res.status(400).json({ error: "حالة غير صالحة" });
        return;
      }
      conditions.push(eq(treasurySessionsTable.status, status as SessionStatus));
    }
    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(treasurySessionsTable)
      .where(where);

    const rows = await sessionSelect(where)
      .orderBy(desc(treasurySessionsTable.openedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({ items: rows.map(serializeSession), total: count, page, pageSize });
  },
);

// GET /treasury/sessions/current — the open session for an account, or null
router.get(
  "/treasury/sessions/current",
  requireAuth,
  requirePermission("treasury.view"),
  async (req, res) => {
    const parsed = GetCurrentTreasurySessionQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "معاملات غير صالحة" });
      return;
    }
    const storeId = req.auth!.storeId;
    const [row] = await sessionSelect(
      and(
        eq(treasurySessionsTable.storeId, storeId),
        eq(treasurySessionsTable.treasuryAccountId, parsed.data.treasuryAccountId),
        eq(treasurySessionsTable.status, "OPEN"),
      ),
    )
      .orderBy(desc(treasurySessionsTable.openedAt))
      .limit(1);
    res.json({ session: row ? serializeSession(row) : null });
  },
);

// POST /treasury/sessions — open a shift
router.post(
  "/treasury/sessions",
  requireAuth,
  requirePermission("treasury.session"),
  async (req, res) => {
    const parsed = OpenTreasurySessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
      return;
    }
    const { treasuryAccountId, openingBalance, notes } = parsed.data;
    const storeId = req.auth!.storeId;
    const userId = req.auth!.userId;

    const [account] = await db
      .select({ id: treasuryAccountsTable.id })
      .from(treasuryAccountsTable)
      .where(
        and(eq(treasuryAccountsTable.id, treasuryAccountId), eq(treasuryAccountsTable.storeId, storeId)),
      )
      .limit(1);
    if (!account) {
      res.status(404).json({ error: "حساب الخزينة غير موجود" });
      return;
    }

    const [existing] = await db
      .select({ id: treasurySessionsTable.id })
      .from(treasurySessionsTable)
      .where(
        and(
          eq(treasurySessionsTable.treasuryAccountId, treasuryAccountId),
          eq(treasurySessionsTable.status, "OPEN"),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "توجد وردية مفتوحة بالفعل لهذا الحساب" });
      return;
    }

    const [created] = await db
      .insert(treasurySessionsTable)
      .values({
        storeId,
        treasuryAccountId,
        openingBalance: money(openingBalance),
        notes: notes ?? null,
        openedBy: userId,
      })
      .returning({ id: treasurySessionsTable.id });

    await writeAuditLog({
      storeId,
      userId,
      action: "treasury.session_opened",
      entityType: "treasury_session",
      entityId: created.id,
      newValue: { treasuryAccountId, openingBalance },
      ipAddress: clientIp(req),
    });

    const [row] = await sessionSelect(eq(treasurySessionsTable.id, created.id)).limit(1);
    res.status(201).json(serializeSession(row));
  },
);

// POST /treasury/sessions/:id/close — close a shift, recording variance
router.post(
  "/treasury/sessions/:id/close",
  requireAuth,
  requirePermission("treasury.session"),
  async (req, res) => {
    const parsed = CloseTreasurySessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
      return;
    }
    const { actualClosingBalance, notes } = parsed.data;
    const storeId = req.auth!.storeId;
    const userId = req.auth!.userId;
    const sessionId = String(req.params["id"]);

    const [session] = await db
      .select({
        id: treasurySessionsTable.id,
        status: treasurySessionsTable.status,
        openingBalance: treasurySessionsTable.openingBalance,
      })
      .from(treasurySessionsTable)
      .where(and(eq(treasurySessionsTable.id, sessionId), eq(treasurySessionsTable.storeId, storeId)))
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "الوردية غير موجودة" });
      return;
    }
    if (session.status !== "OPEN") {
      res.status(400).json({ error: "الوردية مغلقة بالفعل" });
      return;
    }

    // Expected close = opening count + net of money moved during the session.
    const [{ net }] = await db
      .select({
        net: sql<string>`coalesce(sum(case when ${treasuryTransactionsTable.direction} = 'IN' then ${treasuryTransactionsTable.amount} else -${treasuryTransactionsTable.amount} end), 0)`,
      })
      .from(treasuryTransactionsTable)
      .where(eq(treasuryTransactionsTable.sessionId, sessionId));

    const expected = toNum(session.openingBalance) + toNum(net);
    const variance = actualClosingBalance - expected;

    const [row] = await db
      .update(treasurySessionsTable)
      .set({
        status: "CLOSED",
        expectedClosingBalance: money(expected),
        actualClosingBalance: money(actualClosingBalance),
        variance: money(variance),
        notes: notes ?? null,
        closedBy: userId,
        closedAt: new Date(),
      })
      .where(eq(treasurySessionsTable.id, sessionId))
      .returning({ id: treasurySessionsTable.id });

    await writeAuditLog({
      storeId,
      userId,
      action: "treasury.session_closed",
      entityType: "treasury_session",
      entityId: row.id,
      newValue: { expected, actualClosingBalance, variance },
      ipAddress: clientIp(req),
    });

    const [full] = await sessionSelect(eq(treasurySessionsTable.id, sessionId)).limit(1);
    res.json(serializeSession(full));
  },
);

const openedByUser = usersTable;

// Shared session select with account name + opener/closer names resolved.
function sessionSelect(where: ReturnType<typeof and> | ReturnType<typeof eq>) {
  return db
    .select({
      id: treasurySessionsTable.id,
      treasuryAccountId: treasurySessionsTable.treasuryAccountId,
      accountName: treasuryAccountsTable.name,
      status: treasurySessionsTable.status,
      openingBalance: treasurySessionsTable.openingBalance,
      expectedClosingBalance: treasurySessionsTable.expectedClosingBalance,
      actualClosingBalance: treasurySessionsTable.actualClosingBalance,
      variance: treasurySessionsTable.variance,
      notes: treasurySessionsTable.notes,
      openedByName: openedByUser.fullName,
      openedAt: treasurySessionsTable.openedAt,
      closedAt: treasurySessionsTable.closedAt,
    })
    .from(treasurySessionsTable)
    .leftJoin(
      treasuryAccountsTable,
      eq(treasurySessionsTable.treasuryAccountId, treasuryAccountsTable.id),
    )
    .leftJoin(openedByUser, eq(treasurySessionsTable.openedBy, openedByUser.id))
    .where(where);
}

type SessionRow = Awaited<ReturnType<ReturnType<typeof sessionSelect>["limit"]>>[number];

function serializeSession(r: SessionRow) {
  return {
    ...r,
    closedByName: null as string | null,
    openedAt: r.openedAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
  };
}

export default router;
