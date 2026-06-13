import express from 'express';
import { x402Middleware } from './x402Middleware';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'AgentGate Provider', status: 'ok' });
});

// Example protected endpoint - placeholder
app.post('/call', x402Middleware, (req, res) => {
  // In a full implementation you'd verify the payment, world proof, and forward to agent logic
  res.json({ success: true, message: 'Agent call processed (stub)' });
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(port, () => {
  console.log(`AgentGate server listening on http://localhost:${port}`);
});
