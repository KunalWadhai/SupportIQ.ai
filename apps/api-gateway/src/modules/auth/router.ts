import { Router } from "express";
import { RegisterSchema, LoginSchema } from "./contract";
import { validate } from "../../middleware/validate";
import * as controllerMethods from './controller'
import { requireAuth } from "../../middleware/auth";

const authRouter = Router();

authRouter
.post(
    '/register', 
    validate(RegisterSchema), 
    controllerMethods.register
)
.post(
    '/login', 
    validate(LoginSchema), 
    controllerMethods.login
)
.get(
    '/me',
    requireAuth,
    controllerMethods.getMe
);

export default authRouter;