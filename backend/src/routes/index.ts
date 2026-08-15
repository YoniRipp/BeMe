/**
 * Mount all API routers (auth, users, workouts, food, voice, etc.).
 */
import { Router } from 'express';
import { config } from '../config/index.js';
import authRouter from './auth.js';
import usersRouter from './users.js';
import workoutRouter from './workout.js';
import foodEntryRouter from './foodEntry.js';
import dailyCheckInRouter from './dailyCheckIn.js';
import goalRouter from './goal.js';
import foodSearchRouter from './foodSearch.js';
import voiceRouter from './voice.js';
import jobsRouter from './jobs.js';
import adminRouter from './admin.js';
import searchRouter from './search.js';
import insightsRouter from './insights.js';
import uploadsRouter from './uploads.js';
import exercisesRouter from './exercises.js';
import subscriptionRouter from './subscription.js';
import pushRouter from './push.js';
import profileRouter from './profile.js';
import weightRouter from './weight.js';
import waterRouter from './water.js';
import cycleRouter from './cycle.js';
import chatRouter from './chat.js';
import whatsappRouter from './whatsapp.js';
import streakRouter from './streak.js';

const router = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(subscriptionRouter);
router.use(pushRouter);
router.use(usersRouter);
if (!config.bodyServiceUrl) router.use(workoutRouter);
if (!config.energyServiceUrl) {
  router.use(foodEntryRouter);
  router.use(dailyCheckInRouter);
}
if (!config.goalsServiceUrl) router.use(goalRouter);
router.use(foodSearchRouter);
router.use(voiceRouter);
router.use(jobsRouter);
router.use(searchRouter);
router.use(insightsRouter);
router.use(uploadsRouter);
router.use(exercisesRouter);
router.use(profileRouter);
router.use(weightRouter);
router.use(waterRouter);
router.use(cycleRouter);
router.use(chatRouter);
router.use(whatsappRouter);
router.use(streakRouter);

export default router;
