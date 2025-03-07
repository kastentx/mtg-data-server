import express from 'express';
import { checkRemoteFileModified, checkLocalFileModified } from '../helpers/mtgJsonHelpers';

const router = express.Router();

router.get('/', async (req, res) => {
    const lastModifiedRemote = await checkRemoteFileModified();
    const lastModifiedLocal = await checkLocalFileModified();

    res.render('admin', {
        title: 'MTG Admin Dashboard',
        layout: 'main',
        lastModifiedRemote,
        lastModifiedLocal
    });
});

export default router;
