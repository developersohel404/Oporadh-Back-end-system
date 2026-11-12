import { Router } from 'express';
import * as controller from './crime-map.controller.js';

const router = Router();

// Public routes — no auth needed
router.get('/', controller.getMap);
router.get('/heatmap', controller.getHeatmap);
router.get('/statistics', controller.getStatistics);
router.get('/locations/:id', controller.getLocation);

export const crimeMapRouter = router;
