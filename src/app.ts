import express from 'express';
import path from 'path';
import adminRouter from './admin';

const app = express();
const port = process.env.PORT || 3000;

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from templates directory
app.use(express.static(path.join(__dirname, 'templates')));

app.use('/admin', adminRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
