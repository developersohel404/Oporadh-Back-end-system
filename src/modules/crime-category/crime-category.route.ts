import { Router } from 'express';
import * as categoryController from './crime-category.controller.js';

const router = Router();

router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);

export const crimeCategoryRouter = router;
