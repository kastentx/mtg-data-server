import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPriceHistoryByUuidsMock } = vi.hoisted(() => ({
    getPriceHistoryByUuidsMock: vi.fn()
}));

vi.mock('../src/database/db', () => ({
    getPriceHistoryByUuid: vi.fn(),
    getPriceHistoryByUuids: getPriceHistoryByUuidsMock
}));

import cardsRouter from '../src/routes/cardsRouter';

describe('POST /prices/historic/batch', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/cards', cardsRouter);

    beforeEach(() => {
        getPriceHistoryByUuidsMock.mockReset();
    });

    it('returns 400 when uuids parameter is missing or empty', async () => {
        const res = await request(app)
            .post('/api/v1/cards/prices/historic/batch')
            .send({ uuids: [] });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid uuids parameter' });
        expect(getPriceHistoryByUuidsMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid finish value', async () => {
        const res = await request(app)
            .post('/api/v1/cards/prices/historic/batch')
            .send({ uuids: ['u1'], finish: 'etched' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid finish. Expected normal or foil.' });
        expect(getPriceHistoryByUuidsMock).not.toHaveBeenCalled();
    });

    it('defaults finish to normal and computes averages per uuid', async () => {
        getPriceHistoryByUuidsMock.mockResolvedValue({
            u1: [
                { date: '2026-01-03', price: 30, uuid: 'u1' },
                { date: '2026-01-02', price: 20, uuid: 'u1' },
                { date: '2026-01-01', price: 10, uuid: 'u1' }
            ]
        });

        const res = await request(app)
            .post('/api/v1/cards/prices/historic/batch')
            .send({ uuids: ['u1', 'u2'] });

        expect(res.status).toBe(200);
        expect(getPriceHistoryByUuidsMock).toHaveBeenCalledWith(['u1', 'u2'], {
            priceType: 'retail',
            finish: 'normal'
        });
        expect(res.body).toEqual({
            results: [
                {
                    uuid: 'u1',
                    finish: 'normal',
                    averages: {
                        movingAverage90Day: 20,
                        movingAverage30Day: 20,
                        movingAverage7Day: 20
                    }
                },
                {
                    uuid: 'u2',
                    finish: 'normal',
                    averages: {
                        movingAverage90Day: null,
                        movingAverage30Day: null,
                        movingAverage7Day: null
                    }
                }
            ]
        });
    });

    it('normalizes and passes through an explicit foil finish', async () => {
        getPriceHistoryByUuidsMock.mockResolvedValue({});

        const res = await request(app)
            .post('/api/v1/cards/prices/historic/batch')
            .send({ uuids: ['u1'], finish: ' FOIL ' });

        expect(res.status).toBe(200);
        expect(getPriceHistoryByUuidsMock).toHaveBeenCalledWith(['u1'], {
            priceType: 'retail',
            finish: 'foil'
        });
        expect(res.body.results[0]).toEqual({
            uuid: 'u1',
            finish: 'foil',
            averages: {
                movingAverage90Day: null,
                movingAverage30Day: null,
                movingAverage7Day: null
            }
        });
    });
});
