import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import salesRouter from "./sales";
import partnersRouter from "./partners";
import expensesRouter from "./expenses";
import clientsRouter from "./clients";
import movementsRouter from "./movements";
import statsRouter from "./stats";
import exportsRouter from "./exports";
import sellersRouter from "./sellers";
import searchRouter from "./search";
import attachmentsRouter from "./attachments";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/products", productsRouter);
router.use("/sales", salesRouter);
router.use("/partners", partnersRouter);
router.use("/expenses", expensesRouter);
router.use("/clients", clientsRouter);
router.use("/movements", movementsRouter);
router.use("/stats", statsRouter);
router.use("/exports", exportsRouter);
router.use("/sellers", sellersRouter);
router.use("/search", searchRouter);
router.use("/attachments", attachmentsRouter);

export default router;
