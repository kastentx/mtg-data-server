import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { checkFileStatus, downloadCardData, loadCardData } from './cardData';

const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const template = await fs.readFile(path.join(__dirname, 'templates/admin.html'), 'utf-8');
        res.send(template);
    } catch (error) {
        next(error);
    }
});

router.get('/status', async (req, res, next) => {
    try {
        const status = await checkFileStatus();
        res.json(status);
    } catch (error) {
        next(error);
    }
});

router.post('/download', async (req, res, next) => {
    try {
        await downloadCardData();
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.post('/load', async (req, res, next) => {
    try {
        await loadCardData();
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

export default router;
