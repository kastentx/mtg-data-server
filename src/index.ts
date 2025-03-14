import express from 'express';
import cors from 'cors';
import { engine } from 'express-handlebars';
import path from 'path';
import adminRouter from './routes/adminRouter';
import setsRouter from './routes/setsRouter';
import cardsRouter from './routes/cardsRouter';
import { 
  initializeCardStore, 
  loadSymbolData 
} from './services/dataService';
import { closeConnections } from './database/db';

const app = express();
const port = process.env.PORT || 3000;

// Set up templating engine
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'MTG Data Server is running' });
});

app.use('/admin', adminRouter);
app.use('/api/v1/sets', setsRouter);
app.use('/api/v1/cards', cardsRouter);

/**
 * Initialize all data stores
 */
async function initializeData() {
  try {
    console.log('Initializing data...');
    
    // Load symbol data
    await loadSymbolData();
    
    // Initialize card store
    await initializeCardStore();

    console.log('Data loaded successfully!');
  } catch (error) {
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
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await closeConnections();
  process.exit(0);
});
