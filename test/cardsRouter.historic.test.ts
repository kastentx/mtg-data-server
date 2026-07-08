import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPriceHistoryByUuidMock } = vi.hoisted(() => ({
    getPriceHistoryByUuidMock: vi.fn()
}));

vi.mock('../src/database/db', () => ({
    getPriceHistoryByUuid: getPriceHistoryByUuidMock
}));

import cardsRouter from '../src/routes/cardsRouter';

describe('GET /:uuid/prices/historic', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/cards', cardsRouter);

    beforeEach(() => {
        getPriceHistoryByUuidMock.mockReset();
    });

    it('returns 400 for an invalid priceType query value', async () => {
        const res = await request(app)
            .get('/api/v1/cards/test-uuid/prices/historic?priceType=bad-value');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            error: 'Invalid priceType. Expected retail or buylist.'
        });
        expect(getPriceHistoryByUuidMock).not.toHaveBeenCalled();
    });

    it('returns 404 when no historical rows are found', async () => {
        getPriceHistoryByUuidMock.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/v1/cards/abc-123/prices/historic?provider= TCGPLAYER &priceType=Retail&finish=FoIl');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
            error: 'No historical prices found for UUID abc-123'
        });

        expect(getPriceHistoryByUuidMock).toHaveBeenCalledWith('abc-123', {
            provider: 'tcgplayer',
            priceType: 'retail',
            finish: 'foil'
        });
    });

    it('returns historical rows with moving averages', async () => {
        getPriceHistoryByUuidMock.mockResolvedValue([
            { date: '2026-01-03', price: 30, uuid: 'u1' },
            { date: '2026-01-02', price: 20, uuid: 'u1' },
            { date: '2026-01-01', price: 10, uuid: 'u1' }
        ]);

        const res = await request(app)
            .get('/api/v1/cards/u1/prices/historic');

        expect(res.status).toBe(200);
        expect(res.body.historical).toHaveLength(3);
        expect(res.body.averages).toEqual({
            movingAverage90Day: 20,
            movingAverage30Day: 20,
            movingAverage7Day: 20
        });
    });

    it('returns null moving averages when latest date is invalid', async () => {
        getPriceHistoryByUuidMock.mockResolvedValue([
            { date: 'not-a-date', price: 30, uuid: 'u1' },
            { date: '2026-01-02', price: 20, uuid: 'u1' }
        ]);

        const res = await request(app)
            .get('/api/v1/cards/u1/prices/historic');

        expect(res.status).toBe(200);
        expect(res.body.averages).toEqual({
            movingAverage90Day: null,
            movingAverage30Day: null,
            movingAverage7Day: null
        });
    });
});
