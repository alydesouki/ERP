import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import rolesRouter from "./roles";
import permissionsRouter from "./permissions";
import auditRouter from "./audit";
import catalogRouter from "./catalog";
import warehousesRouter from "./warehouses";
import productsRouter from "./products";
import inventoryRouter from "./inventory";
import treasuryRouter from "./treasury";
import customersRouter from "./customers";
import suppliersRouter from "./suppliers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(rolesRouter);
router.use(permissionsRouter);
router.use(auditRouter);
router.use(catalogRouter);
router.use(warehousesRouter);
router.use(productsRouter);
router.use(inventoryRouter);
router.use(treasuryRouter);
router.use(customersRouter);
router.use(suppliersRouter);

export default router;
