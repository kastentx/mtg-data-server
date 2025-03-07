import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { checkFileStatus, loadCardData } from './cardData';

const router = Router();

router.get('/status', asyncHandler(async (req, res) => {
  const status = await checkFileStatus();
  res.json(status);
}));

router.get('/cards', asyncHandler(async (req, res) => {
  const data = await loadCardData();
  res.json(data);
}));

export { router };
