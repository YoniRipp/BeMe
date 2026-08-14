/**
 * Semantic search routes.
 */
import { Router } from 'express';
import { withUser } from './helpers.js';
import * as searchController from '../controllers/search.js';

const router = Router();

router.post('/api/search', withUser, searchController.search);

export default router;
