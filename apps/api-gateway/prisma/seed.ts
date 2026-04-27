/**
 * Prisma seed script
 * Run with: npx prisma db seed
 * Add to package.json: "prisma": { "seed": "tsx prisma/seed.ts" }
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Demo Organisation ────────────────────────────────────────────────────
  const org = await prisma.organisation.upsert({
    where: { slug: "acme-corp-demo" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp-demo",
      widgetColor: "#6366f1",
      widgetGreeting: "Hi! I'm Acme's AI support assistant. How can I help you today?",
      plan: "PRO",
      apiKey: "demo-api-key-acme-corp-1234567890",
    },
  });

  console.log(`✅ Organisation: ${org.name} (${org.id})`);

  // ─── Demo Admin User ──────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("demo1234!", 12);

  const owner = await prisma.user.upsert({
    where: { email: "demo@acme.com" },
    update: {},
    create: {
      name: "Alex Chen",
      email: "demo@acme.com",
      password: hashedPassword,
      role: "OWNER",
      orgId: org.id,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "support@acme.com" },
    update: {},
    create: {
      name: "Jordan Smith",
      email: "support@acme.com",
      password: hashedPassword,
      role: "MEMBER",
      orgId: org.id,
    },
  });

  console.log(`✅ Users: ${owner.email}, ${member.email}`);

  // ─── Demo Knowledge Documents ─────────────────────────────────────────────
  const docs = await Promise.all([
    prisma.knowledgeDocument.upsert({
      where: { id: "seed-doc-1" },
      update: {},
      create: {
        id: "seed-doc-1",
        orgId: org.id,
        name: "Acme Product FAQ.pdf",
        type: "PDF",
        status: "READY",
        fileSize: 245_000,
        chunkCount: 42,
        storageKey: `${org.id}/faq.pdf`,
      },
    }),
    prisma.knowledgeDocument.upsert({
      where: { id: "seed-doc-2" },
      update: {},
      create: {
        id: "seed-doc-2",
        orgId: org.id,
        name: "Shipping & Returns Policy",
        type: "URL",
        status: "READY",
        sourceUrl: "https://acme.com/policies/shipping",
        chunkCount: 18,
      },
    }),
    prisma.knowledgeDocument.upsert({
      where: { id: "seed-doc-3" },
      update: {},
      create: {
        id: "seed-doc-3",
        orgId: org.id,
        name: "Installation Guide v2.docx",
        type: "DOCX",
        status: "READY",
        fileSize: 98_000,
        chunkCount: 27,
        storageKey: `${org.id}/install-guide.docx`,
      },
    }),
    prisma.knowledgeDocument.upsert({
      where: { id: "seed-doc-4" },
      update: {},
      create: {
        id: "seed-doc-4",
        orgId: org.id,
        name: "API Reference.md",
        type: "MARKDOWN",
        status: "PROCESSING",
        fileSize: 52_000,
        storageKey: `${org.id}/api-ref.md`,
      },
    }),
  ]);

  console.log(`✅ Documents: ${docs.length} created`);

  // ─── Demo Conversations ────────────────────────────────────────────────────
  const conversationData: Array<{
    id: string;
    status: "OPEN" | "RESOLVED" | "ESCALATED";
    visitorEmail?: string;
    daysAgo: number;
    messages: Array<{ role: "USER" | "ASSISTANT"; content: string; confidence?: number }>;
  }> = [
    {
      id: "seed-conv-1",
      status: "RESOLVED",
      visitorEmail: "user1@example.com",
      daysAgo: 0,
      messages: [
        { role: "USER", content: "What is your return policy?" },
        {
          role: "ASSISTANT",
          content:
            "Our return policy allows you to return any item within 30 days of purchase for a full refund. Items must be unused and in original packaging. For damaged or defective items, we offer free returns at any time. You can initiate a return through your account dashboard or by contacting us.",
          confidence: 0.91,
        },
        { role: "USER", content: "Great, thanks! What about international returns?" },
        {
          role: "ASSISTANT",
          content:
            "For international returns, you have 45 days from the delivery date. Please note that return shipping costs are the customer's responsibility unless the item is defective. Refunds are processed in the original currency within 5–7 business days after we receive the item.",
          confidence: 0.87,
        },
      ],
    },
    {
      id: "seed-conv-2",
      status: "ESCALATED",
      visitorEmail: "user2@example.com",
      daysAgo: 1,
      messages: [
        { role: "USER", content: "My order #12345 hasn't arrived and it's been 2 weeks" },
        {
          role: "ASSISTANT",
          content:
            "I'm sorry to hear your order hasn't arrived yet. Standard shipping typically takes 5–7 business days, so a 2-week delay is definitely outside the norm. I'd recommend checking your tracking number first. However, for specific order issues like this, our human support team can investigate directly and resolve it faster. I'll flag this conversation for them now.",
          confidence: 0.32,
        },
      ],
    },
    {
      id: "seed-conv-3",
      status: "RESOLVED",
      daysAgo: 2,
      messages: [
        { role: "USER", content: "How do I install the SDK on Windows?" },
        {
          role: "ASSISTANT",
          content:
            "To install the Acme SDK on Windows:\n\n1. Download the installer from our releases page\n2. Run the `.exe` as Administrator\n3. Accept the license agreement and choose your install directory\n4. Add `C:\\Program Files\\Acme\\bin` to your PATH environment variable\n5. Verify with `acme --version` in a new terminal\n\nRequirements: Windows 10+, .NET 6.0 runtime.",
          confidence: 0.94,
        },
      ],
    },
    {
      id: "seed-conv-4",
      status: "OPEN",
      daysAgo: 0,
      messages: [
        { role: "USER", content: "Do you offer a free trial?" },
        {
          role: "ASSISTANT",
          content:
            "Yes! We offer a 14-day free trial on all plans — no credit card required. You get full access to all features during the trial period. To get started, simply sign up on our pricing page and select 'Start Free Trial'. You'll receive a confirmation email with setup instructions.",
          confidence: 0.89,
        },
        { role: "USER", content: "Can I extend the trial if I need more time?" },
        {
          role: "ASSISTANT",
          content:
            "Trial extensions are available on a case-by-case basis. If you need more time to evaluate, please reach out to our sales team at sales@acme.com or use the in-app chat before your trial expires. We typically accommodate reasonable extension requests, especially for teams still onboarding.",
          confidence: 0.78,
        },
      ],
    },
    {
      id: "seed-conv-5",
      status: "RESOLVED",
      daysAgo: 5,
      messages: [
        { role: "USER", content: "What payment methods do you accept?" },
        {
          role: "ASSISTANT",
          content:
            "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover), PayPal, bank transfers for annual enterprise plans, and cryptocurrency (BTC, ETH) via our crypto checkout. All payments are processed securely through Stripe.",
          confidence: 0.96,
        },
      ],
    },
  ];

  for (const convData of conversationData) {
    const createdAt = new Date(Date.now() - convData.daysAgo * 24 * 60 * 60 * 1000);

    await prisma.conversation.upsert({
      where: { id: convData.id },
      update: {},
      create: {
        id: convData.id,
        orgId: org.id,
        sessionId: `session-${convData.id}`,
        status: convData.status,
        visitorEmail: convData.visitorEmail,
        escalatedAt: convData.status === "ESCALATED" ? createdAt : null,
        resolvedAt: convData.status === "RESOLVED" ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
        createdAt,
        updatedAt: createdAt,
        messages: {
          create: convData.messages.map((msg, i) => ({
            role: msg.role,
            content: msg.content,
            confidence: msg.confidence,
            sources:
              msg.role === "ASSISTANT" && msg.confidence && msg.confidence > 0.5
                ? [
                    {
                      document_id: "seed-doc-1",
                      document_name: "Acme Product FAQ.pdf",
                      excerpt: "Relevant excerpt from the FAQ document...",
                      score: msg.confidence,
                    },
                  ]
                : null,
            createdAt: new Date(createdAt.getTime() + i * 30_000),
          })),
        },
      },
    });
  }

  console.log(`✅ Conversations: ${conversationData.length} created with messages`);

  console.log(`
🎉 Seed complete!

  Dashboard:  http://localhost:3000
  Login:      demo@acme.com / demo1234!
  API key:    demo-api-key-acme-corp-1234567890
  Org ID:     ${org.id}
  `);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
