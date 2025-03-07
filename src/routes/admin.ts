import express from 'express';
import { checkRemoteFileModified, checkLocalFileModified, downloadCardData } from '../helpers/mtgJsonHelpers';

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

router.post('/download', async (req, res) => {
    try {
        await downloadCardData();
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error downloading data');
    }
});

export default router;
