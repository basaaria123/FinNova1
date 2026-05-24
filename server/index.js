const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "finnova_secret_key";

app.use(cors({
  origin: [
    "http://localhost:8080",
    "http://localhost:5173",
    process.env.FRONTEND_URL || "*"
  ],
  credentials: true
}));
app.use(express.json());

// Middleware for JWT Verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) return res.status(401).json({ error: "Access denied" });
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// ---- Auth Routes ----

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "An account with this email already exists" });
    
    const user = await prisma.user.create({
      data: { name, email, password } 
    });
    
    const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: "7d" });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: "Error creating user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "No account found with this email" });
    if (user.password !== password) return res.status(400).json({ error: "Incorrect password" });
    
    const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, SECRET_KEY, { expiresIn: "7d" });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: "Error logging in" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "No account found with this email" });
    
    await prisma.user.update({
      where: { email },
      data: { password: newPassword }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error resetting password" });
  }
});

// ---- Expenses Routes ----

app.get("/api/expenses", authenticateToken, async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.userId },
      orderBy: { date: "desc" }
    });
    const mapped = expenses.map(e => ({
      ...e,
      note: e.description
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: "Error fetching expenses" });
  }
});

app.post("/api/expenses", authenticateToken, async (req, res) => {
  const { id, amount, category, date, note } = req.body;
  try {
    const expense = await prisma.expense.create({
      data: {
        id, 
        amount,
        category,
        date,
        description: note || "", 
        userId: req.user.userId
      }
    });
    res.json({ ...expense, note: expense.description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creating expense" });
  }
});

app.delete("/api/expenses/:id", authenticateToken, async (req, res) => {
  try {
    await prisma.expense.deleteMany({
      where: { id: req.params.id, userId: req.user.userId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error deleting expense" });
  }
});

// ---- Budget Routes ----

app.get("/api/budget", authenticateToken, async (req, res) => {
  try {
    const budget = await prisma.budget.findUnique({
      where: { userId: req.user.userId }
    });
    res.json(budget || { monthly: 0 });
  } catch (error) {
    res.status(500).json({ error: "Error fetching budget" });
  }
});

app.post("/api/budget", authenticateToken, async (req, res) => {
  const { monthly } = req.body;
  try {
    const budget = await prisma.budget.upsert({
      where: { userId: req.user.userId },
      update: { monthly },
      create: { monthly, userId: req.user.userId }
    });
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: "Error updating budget" });
  }
});

// ---- Goals Routes ----

app.get("/api/goals", authenticateToken, async (req, res) => {
  try {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: req.user.userId }
    });
    const mapped = goals.map(g => ({
      ...g,
      name: g.title
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: "Error fetching goals" });
  }
});

app.post("/api/goals", authenticateToken, async (req, res) => {
  const { id, name, target, saved } = req.body;
  try {
    const goal = await prisma.savingsGoal.create({
      data: { id, title: name || "Untitled", target, saved, userId: req.user.userId }
    });
    res.json({ ...goal, name: goal.title });
  } catch (error) {
    res.status(500).json({ error: "Error creating goal" });
  }
});

app.put("/api/goals/:id", authenticateToken, async (req, res) => {
  const { saved } = req.body;
  try {
    await prisma.savingsGoal.updateMany({
      where: { id: req.params.id, userId: req.user.userId },
      data: { saved }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error updating goal" });
  }
});

app.delete("/api/goals/:id", authenticateToken, async (req, res) => {
  try {
    await prisma.savingsGoal.deleteMany({
      where: { id: req.params.id, userId: req.user.userId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error deleting goal" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
