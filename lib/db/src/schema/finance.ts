import { boolean, date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { treasuryAccountsTable } from "./treasury";
import { usersTable } from "./users";

// Expense classification (e.g. Rent, Utilities, Marketing). Tenant-scoped.
export const expenseCategoriesTable = pgTable(
  "expense_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("expense_categories_store_name_unique").on(table.storeId, table.name)],
);

// A recorded expense. Posts a treasury OUT and an Operating-Expenses journal entry.
export const expensesTable = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategoriesTable.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    expenseDate: date("expense_date").notNull(),
    description: text("description"),
    treasuryAccountId: uuid("treasury_account_id")
      .notNull()
      .references(() => treasuryAccountsTable.id, { onDelete: "restrict" }),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expenses_store_date_idx").on(table.storeId, table.expenseDate),
    index("expenses_category_idx").on(table.categoryId),
  ],
);

// Staff record. Optionally linked to a system user account. monthlySalary is the
// default used when generating salary records.
export const employeesTable = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone"),
    jobTitle: text("job_title"),
    monthlySalary: numeric("monthly_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    // Outstanding advances owed back by the employee.
    advanceBalance: numeric("advance_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("employees_store_idx").on(table.storeId)],
);

export const salaryStatusEnum = pgEnum("salary_status", ["PENDING", "PAID"]);

// A monthly salary line for an employee. When paid, posts treasury OUT + journal.
export const salaryRecordsTable = pgTable(
  "salary_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    periodMonth: text("period_month").notNull(),
    baseSalary: numeric("base_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    deductions: numeric("deductions", { precision: 14, scale: 2 }).notNull().default("0"),
    bonuses: numeric("bonuses", { precision: 14, scale: 2 }).notNull().default("0"),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    status: salaryStatusEnum("status").notNull().default("PENDING"),
    treasuryAccountId: uuid("treasury_account_id").references(() => treasuryAccountsTable.id, {
      onDelete: "restrict",
    }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("salary_records_employee_period_unique").on(table.employeeId, table.periodMonth),
    index("salary_records_store_idx").on(table.storeId),
  ],
);

// Cash advance given to an employee, recovered from future salary.
export const employeeAdvancesTable = pgTable(
  "employee_advances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    advanceDate: date("advance_date").notNull(),
    notes: text("notes"),
    treasuryAccountId: uuid("treasury_account_id")
      .notNull()
      .references(() => treasuryAccountsTable.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("employee_advances_employee_idx").on(table.employeeId)],
);

export const equityMovementTypeEnum = pgEnum("equity_movement_type", ["WITHDRAWAL", "DEPOSIT"]);

// Owner capital movements: WITHDRAWAL (drawings) or DEPOSIT (capital injection).
export const equityMovementsTable = pgTable(
  "equity_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => storesTable.id, { onDelete: "restrict" }),
    type: equityMovementTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    movementDate: date("movement_date").notNull(),
    description: text("description"),
    treasuryAccountId: uuid("treasury_account_id")
      .notNull()
      .references(() => treasuryAccountsTable.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("equity_movements_store_idx").on(table.storeId, table.movementDate)],
);

export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategoriesTable.$inferInsert;
export type Expense = typeof expensesTable.$inferSelect;
export type InsertExpense = typeof expensesTable.$inferInsert;
export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = typeof employeesTable.$inferInsert;
export type SalaryRecord = typeof salaryRecordsTable.$inferSelect;
export type InsertSalaryRecord = typeof salaryRecordsTable.$inferInsert;
export type EmployeeAdvance = typeof employeeAdvancesTable.$inferSelect;
export type InsertEmployeeAdvance = typeof employeeAdvancesTable.$inferInsert;
export type EquityMovement = typeof equityMovementsTable.$inferSelect;
export type InsertEquityMovement = typeof equityMovementsTable.$inferInsert;
