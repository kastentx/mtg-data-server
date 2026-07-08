export type HistoricalPriceEntry = {
    date: string;
    price: number;
};

export type MovingAverages = {
    movingAverage90Day: number | null;
    movingAverage30Day: number | null;
    movingAverage7Day: number | null;
};

/**
 * Computes a simple moving average of price entries within `windowDays` of
 * the most recent date. Assumes `historicalPrices` is sorted newest first
 * (i.e. `historicalPrices[0]` is the latest date in the set).
 */
export function calculateMovingAverageForWindow(
    historicalPrices: Array<HistoricalPriceEntry>,
    windowDays: number
): number | null {
    if (!historicalPrices.length) {
        return null;
    }

    const latestDate = new Date(historicalPrices[0].date);
    if (Number.isNaN(latestDate.getTime())) {
        return null;
    }

    const windowStart = new Date(latestDate);
    windowStart.setDate(windowStart.getDate() - (windowDays - 1));

    const windowPrices = historicalPrices
        .filter((entry) => {
            const entryDate = new Date(entry.date);
            return !Number.isNaN(entryDate.getTime()) && entryDate >= windowStart;
        })
        .map((entry) => entry.price)
        .filter((price) => Number.isFinite(price));

    if (!windowPrices.length) {
        return null;
    }

    const sum = windowPrices.reduce((acc, price) => acc + price, 0);
    return Number((sum / windowPrices.length).toFixed(4));
}

/**
 * Computes the standard 90/30/7-day moving averages for a single card's
 * historical price entries (newest first).
 */
export function calculateMovingAverages(historicalPrices: Array<HistoricalPriceEntry>): MovingAverages {
    return {
        movingAverage90Day: calculateMovingAverageForWindow(historicalPrices, 90),
        movingAverage30Day: calculateMovingAverageForWindow(historicalPrices, 30),
        movingAverage7Day: calculateMovingAverageForWindow(historicalPrices, 7)
    };
}
