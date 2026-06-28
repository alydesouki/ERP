import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import rolesRouter from "./roles";
import permissionsRouter from "./permissions";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(rolesRouter);
router.use(permissionsRouter);
router.use(auditRouter);

export default router;
