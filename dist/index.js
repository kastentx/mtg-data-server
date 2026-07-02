"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_handlebars_1 = require("express-handlebars");
const path_1 = __importDefault(require("path"));
const adminRouter_1 = __importDefault(require("./routes/adminRouter"));
const setsRouter_1 = __importDefault(require("./routes/setsRouter"));
const cardsRouter_1 = __importDefault(require("./routes/cardsRouter"));
const dataService_1 = require("./services/dataService");
const db_1 = require("./database/db");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Set up templating engine
app.engine('handlebars', (0, express_handlebars_1.engine)());
app.set('view engine', 'handlebars');
app.set('views', path_1.default.join(__dirname, 'views'));
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.get('/', (req, res) => {
    res.json({ message: 'MTG Data Server is running' });
});
app.use('/admin', adminRouter_1.default);
app.use('/api/v1/sets', setsRouter_1.default);
app.use('/api/v1/cards', cardsRouter_1.default);
/**
 * Initialize all data stores
 */
async function initializeData() {
    try {
        console.log('Initializing data...');
        const refreshResult = await (0, dataService_1.refreshDataAndReload)();
        console.log(`Data refresh completed. Card DB updated: ${refreshResult.cardDataUpdated}, Pricing DB updated: ${refreshResult.pricingDataUpdated}, Historical Pricing DB updated: ${refreshResult.historicalPricingDataUpdated}`);
        console.log('Data loaded successfully!');
    }
    catch (error) {
        console.error('Failed to initialize data:', error);
        process.exit(1);
    }
}
// Start the server
app.listen(port, async () => {
    console.log(`Server started on port ${port}`);
    await initializeData();
});
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await (0, db_1.closeConnections)();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Shutting down server...');
    await (0, db_1.closeConnections)();
    process.exit(0);
});
