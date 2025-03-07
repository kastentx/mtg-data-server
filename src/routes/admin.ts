import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.render('admin', {
        title: 'MTG Admin Dashboard',
        layout: 'main'
    });
});

export default router;
