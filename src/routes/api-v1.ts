import express from 'express';
import asyncHandler from 'express-async-handler';
import { checkRemoteFileModified } from '../helpers/mtgJsonHelpers';

const router = express.Router();


router.get('/status', asyncHandler(async (req, res) => {
    const status = 'OK';
    res.json(status);
}));

router.get('/last-modified', async (req, res, next) => {
    try {
        const lastModified = await checkRemoteFileModified();
        res.json({ lastModified });
    } catch (error) {
        next(error);
    }
});

export default router;
