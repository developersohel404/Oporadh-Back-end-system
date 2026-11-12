import { Router } from 'express';
import * as locationController from './location.controller.js';

const router = Router();

// Divisions
router.get('/divisions', locationController.getDivisions);

// Districts by Division
router.get('/divisions/:id/districts', locationController.getDistricts);

// Upazilas by District
router.get('/districts/:id/upazilas', locationController.getUpazilas);

// Unions by Upazila
router.get('/upazilas/:id/unions', locationController.getUnions);

// Pourashavas by Upazila
router.get('/upazilas/:id/pourashavas', locationController.getPourashavas);

// Upazila details (with unions + pourashavas + parent info)
router.get('/upazilas/:id', locationController.getUpazila);

export const locationRouter = router;
